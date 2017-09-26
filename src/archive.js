'use strict';

var fs = require('fs');

var async = require('async');
var command = require('commander');
var config = require('config');
var csv = require('csv');
var _ = require('lodash');
var path = require('path');
var Q = require('q');
var SSH = require('simple-ssh');
var tar = require('tar-fs');

var helper = require('./helper');

command
  .description('Preserve user deleted repositories to a long term archive')
  .option('-r, --repo <all|recent>', 'Process all repos or just recently deleted repos')
  .parse(process.argv);

var log = helper.logger('archive-repo', config.get('log.dir'),
  config.get('log.level'), config.get('log.retention'));


/**
 * Retrieve a list of deleted repos from the live GHE instance
 */
/* istanbul ignore next */
var deletedRepos = function(config, mode) {
  log.info('Getting the list of deleted repos');

  var deferred = Q.defer();
  var cmd = mode === 'all' ?
    config.get('github.search-query-all') :
    config.get('github.search-query-recent');

  // We query Redis to get the list of repo marked as deleted
  var ssh = new SSH({
    user: config.get('github.username'),
    host: config.get('github.host'),
    port: config.get('github.port'),
    pass: config.get('ssh-private-key.pass-phrase'),
    key:  fs.readFileSync(config.get('ssh-private-key.file')),
    timeout: 1000*config.get('github.timeout')
  });

  log.debug('Executing command on GHE:', cmd);
  // Connect to GHE via SSH and run a redis query to find info about deleted repos
  ssh.exec(cmd, {
    exit: function(code, stdout, stderr) {
      var columns = ['id', 'owner', 'name', 'name_with_owner', 'shard_path', 'has_wiki'];
      csv.parse(stdout, { columns: columns }, function(err, repos) {
        if (err) {
          log.error('Cannot parse the list of repositories', err);
          deferred.reject(err);
        } else {
          log.info('Found', repos.length, 'deleted repositories');
          deferred.resolve(repos);
        }
      });
    },
    err: function(stderr) {
      // this error happens on the GHE instance we connect too
      log.error('Error while querying Redis on GHE for deleted repositories', stderr);
      deferred.reject(stderr);
    }
  })
  .on('error', function(err) {
    // this error happens locally
    log.error('Error while SSHing to GHE to query for deleted repositories', err);
    deferred.reject(err);
  })
  .start();

  return deferred.promise;
};

/**
 * Create a tarball from a Github snapshot
 */
var tarball = function(snapshot, archive, done) {
  // create the stream first (before resolving the path)
  // to make timing of firing of events easier in unit tests
  var archiveDir = path.dirname(archive);
  if (!fs.existsSync(archiveDir)) {
    log.debug('Creating dir', archiveDir);
    fs.mkdirSync(archiveDir);
  }

  var ws = fs.createWriteStream(archive)
    .on('error', function(err) {
      log.error('Cannot write to file', archive, err);

      helper.alert(config.get('email.recipients'), config.get('email.sender'),
        err, log, function(err1, res1) {
          // best effort to send the email
          done(err);
        });
    })
    .on('finish', function() {
      log.info('Directory', snapshot, 'archived to file', archive);
      done();
    });

  fs.realpath(snapshot, function(err, path) {
    if (err) {
      log.warn('Repo not yet backed up to the snapshot', snapshot, err);
      done();
    } else {
      /* istanbul ignore else */
      if (snapshot !== path) {
        log.info(snapshot, 'resolves to', path);
        snapshot = path;
      }

      log.debug('Archiving directory', snapshot, 'to file', archive);
      log.info('Creating tarball', archive);
      tar.pack(snapshot).pipe(ws);
    }
  });
};

/**
 * Process one repo and its associated wiki
 */
var archive = function(repo, done) {
  log.info('Processing repo', repo.id, repo.name_with_owner);

  var paths = helper.paths(repo.id, repo.owner, repo.name, repo.shard_path,
    config.get('dir.archive'), config.get('dir.snapshots'));
  log.debug(paths);

  async.series([
      tarball.bind(tarball, paths.snapshot.code, paths.archive.code),
      tarball.bind(tarball, paths.snapshot.wiki, paths.archive.wiki)
    ],
    function(err) {
      if (err) {
        log.error('Cannot archive repository', repo.id, repo.name_with_owner, err);
        done(err);
      } else {
        log.info('Repo', repo.id, repo.name_with_owner, 'is archived at', paths.archive.code);
        done();
      }
    }
  );
};

/**
 * Process one batch of repos in parallel
 */
/* istanbul ignore next */
var repoBatch = function(batch, done) {
  log.debug('Process one batch of', batch.length, 'repos');

  async.each(batch, archive, function(err) {
    if (err) {
      log.error('Cannot archive repository', err);
      done(err);
    } else {
      log.info('Processed a batch of', batch.length, 'repositories');
      done();
    }
  });
};

var processDeleted = function(config, mode, done) {
  deletedRepos(config, mode)
    .then(
      function(repos) {
        // break the list of repos into small bacthes. Process one batch at the time
        // to prevent over usage of system resources
        var batches = _.chunk(repos, config.get('batch-size'));
        log.debug('Divided', repos.length, 'repositories into', batches.length, 'batches of',
          config.get('batch-size'), 'repos each');

        // loop over the list batches
        async.each(batches, repoBatch, function(err) {
          if (err) {
            log.error('Unable to process a batch of repositories', err);
            done(err);
          } else {
            log.info('Processed', batches.length, 'batches totaling', repos.length, 'repos');
            done(null, { batches: batches.length, repos: repos.length });
          }
        });
      },
      function(err) {
        log.error('Cannot get the list of repositories', err);
        done(err);
      }
    );
}

/* istanbul ignore else */
if (process.env.NODE_ENV !== 'test') {
  var mode = command.repo !== 'all' ? 'recent' : 'all';

  processDeleted(config, mode, function(err, res) {})
}