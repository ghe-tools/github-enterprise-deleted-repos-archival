'use strict';

var path = require('path');

var bunyan = require('bunyan');
var _ = require('lodash');
var md5 = require('md5');
var nodemailer = require('nodemailer');

exports = module.exports = {

  /**
   * Get a logger
   */
  /* istanbul ignore next */
  logger: function(app, dir, level, retention) {
    return bunyan.createLogger({
      name: app,
      streams: [
        {
          level: 'trace',
          stream: process.stdout
        }, {
          type: 'rotating-file',
          level: level,
          path: path.format({
            dir: dir,
            base: app + '.log'
          }),
          period: '1w',
          count: retention
        }
      ]
    });
  },

  /**
   * Alert that a failure occured by sending an email to a number of recipients
   */
  alert: function(recipients, sender, error, log, done) {
    log.debug('Sending alert email to', recipients);

    nodemailer.createTransport().sendMail({
      from: sender,
      to: recipients.join(','),
      subject: 'GHE backup of deleted repos dailed!',
      text: 'archive.js encountered the error below.\n\n' + error
    }, function(err, res) {
      if (err) {
        log.error('Cannot send alert email to', recipients, err);
        done(err);
      } else {
        log.info('Alert email sent to', recipients);
        log.debug('Error reported in email', error);
        done();
      }
    });
  },

  /**
   * Get all the path locations containing files for the given repo
   * The dir in GHE looks like this /data/repositories/1/nw/13/85/97/140/177.git
   */
  paths: function(repoId, owner, repoName, dir, archiveRoot, snapshotsRoot) {
    // the filename of the archive containing the repo
    var archiveFile = _.deburr(repoId + '_' + owner + '_' + repoName);

    // the folder to store the archive. We split archives into sub folders
    // to avoid having to many into one
    var archiveDir = archiveRoot + '/' + md5(archiveFile).substring(0, 4);

    // the folder of the snapshot containing the repo source code
    var snapshotCodeDir = path.join(snapshotsRoot, dir.substring('/data/'.length));

    // the folder of the snapshot containing the wiki pages
    var snapshotWikiDir = snapshotCodeDir.substring(0, snapshotCodeDir.length - '.git'.length) + '.wiki.git';

    return {
      id: repoId,
      name: repoName,
      owner: owner,
      dir: dir,
      snapshot: {
        code: snapshotCodeDir,
        wiki: snapshotWikiDir
      },
      archive: {
        code: path.join(archiveDir, archiveFile + '.tar'),
        wiki: path.join(archiveDir, archiveFile + '.wiki.tar')
      }
    }
  }

};