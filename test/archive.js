'use strict';

var os = require('os');
var PassThrough = require('stream').PassThrough;

var rewire = require('rewire');
var sinon = require('sinon');
var should = require('should');

var archive = rewire('../src/archive')

describe('archive', function() {
  var sandbox;
  var error = 'Oops! An Error';

  before(function() {
    var log = {
      trace: sinon.spy(),
      debug: sinon.spy(),
      info: sinon.spy(),
      warn: sinon.spy(),
      error: sinon.spy(),
      fatal: sinon.spy()
    };
    archive.__set__('log', log);
  });

  after(function() {
  });

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('tarball()', function() {
    it('should create folder', function(done) {
      var realpath = 'the-real-path';
      var ws = new PassThrough();
      var fs = {
        existsSync: sandbox.stub().returns(false),
        mkdirSync: sandbox.stub(),
        createWriteStream: sandbox.stub().returns(ws),
        realpath: sandbox.stub().yields(null, realpath)
      };
      var tar = {
        pack: sandbox.stub().returns({ pipe: sinon.stub() })
      };

      var callback = function (err, res) {
        should.not.exist(err);
        fs.createWriteStream.calledOnce.should.be.true();
        fs.mkdirSync.calledOnce.should.be.true();
        tar.pack.calledWith(realpath).should.be.true();
        done();
      };

      archive.__set__('fs', fs);
      archive.__set__('tar', tar);

      var tarball = archive.__get__('tarball');
      tarball('the-symlink', os.tmpdir() + '/tarball.tar', callback);
      ws.emit('finish');
    });

    it('should follow symlink and tar snapshot', function(done) {
      var realpath = 'the-real-path';
      var ws = new PassThrough();
      var fs = {
        existsSync: sandbox.stub().returns(true),
        createWriteStream: sandbox.stub().returns(ws),
        realpath: sandbox.stub().yields(null, realpath)
      };
      var tar = {
        pack: sandbox.stub().returns({ pipe: sinon.stub() })
      };

      var callback = function (err, res) {
        should.not.exist(err);
        fs.createWriteStream.calledOnce.should.be.true();
        tar.pack.calledWith(realpath).should.be.true();
        done();
      };
      archive.__set__('fs', fs);
      archive.__set__('tar', tar);

      var tarball = archive.__get__('tarball');
      tarball('the-symlink', os.tmpdir() + '/tarball.tar', callback);
      ws.emit('finish');
    });

    it('should not find snapshot', function(done) {
      this.timeout(5000);

      var ws = new PassThrough();
      var fs = {
        existsSync: sandbox.stub().returns(true),
        createWriteStream: sandbox.stub().returns(ws),
        realpath: sandbox.stub().yields(error)
      };
      var tar = {
        pack: sandbox.spy()
      };
      var callback = function(err, res) {
        should.not.exist(err);
        should.not.exist(res);
        tar.pack.callCount.should.be.equal(0);
        done();
      };

      archive.__set__('fs', fs);
      archive.__set__('tar', tar);

      var tarball = archive.__get__('tarball');
      tarball('test', '/archives/GitHub-2015-09-16-Wed.tar', callback);
    });

    it('should send an alert on failure', function(done) {
      this.timeout(5000);

      var ws = new PassThrough();
      var tarfile = '/archives/GitHub-2015-09-16-Wed.tar';
      var fs = {
        existsSync: sandbox.stub().returns(true),
        createWriteStream: sandbox.stub().returns(ws),
        realpath: sandbox.stub().yields()
      };
      var helper = {
        alert: sandbox.stub().yields()
      };
      var tar = {
        pack: sandbox.stub().returns({ pipe: sinon.stub() })
      };
      var callback = function(err, res) {
        should.not.exist(res);
        err.should.be.equal(error);
        helper.alert.calledOnce.should.be.true();
        helper.alert.calledWith(['github-ops@your-company-name.com'],
          'github@your-company-name.com', error).should.be.true();
        done();
      };

      archive.__set__('fs', fs);
      archive.__set__('helper', helper);
      archive.__set__('tar', tar);

      var tarball = archive.__get__('tarball');
      tarball('test', tarfile, callback);
      ws.emit('error', error);
    });
  });

  describe('archive', function() {
    it('should fail while archiving repo', function(done) {
      var repo = {
        id: 123,
        owner: 'jdoe',
        name: 'my-new-repo',
        shard_path: 'repositories/5/nw/5b/5a',
      };
      var tarball = sandbox.stub().onFirstCall().yields(error);
      var helper = {
        paths: sandbox.stub().returns()
      };

      var callback = function(err, res) {
        should.not.exist(res);
        err.should.be.equal(error);
        tarball.calledOnce.should.be.true();
        done();
      };

      archive.__set__('helper', helper);
      archive.__set__('tarball', tarball);

      var a = archive.__get__('archive');
      a(repo, callback);
    });

    it('should fail while archiving wiki', function(done) {
      var tarball = sandbox.stub(archive, 'tarball');
      tarball.onFirstCall().yields();
      tarball.onSecondCall().yields(error);

      var repo = {
        id: 123,
        owner: 'jdoe',
        name: 'my-new-repo',
        shard_path: 'repositories/5/nw/5b/5a',
      };

      var callback = function(err, res) {
        should.not.exist(res);
        err.should.be.equal(error);
        tarball.calledTwice.should.be.true();
        done();
      };

      archive.archive(repo, callback);
    });

    it('should archive repo and its wiki', function(done) {
      var tarball = sandbox.stub(archive, 'tarball').yields();

      var repo = {
        id: 123,
        owner: 'jdoe',
        name: 'my-new-repo',
        shard_path: 'repositories/5/nw/5b/5a',
      };

      var callback = function(err, res) {
        should.not.exist(res);
        should.not.exist(err);
        tarball.calledTwice.should.be.true();
        done();
      };

      archive.archive(repo, callback);
    });
  });

  describe('repoBatch', function() {
    it('should run thru the whole batch', function(done) {
      var batch = ['repo1', 'repo2', 'repo3'];
      var callback = function(err, res) {
        archive.archive.callCount.should.be.equal(3);
        should.not.exist(err);
        done();
      }

      sandbox.stub(archive, 'archive').yields();
      archive.repoBatch(batch, callback);
    });

    it('should abort this batch', function(done) {
      var batch = ['repo1', 'repo2', 'repo3'];
      var callback = function(err, res) {
        archive.archive.callCount.should.be.equal(1);
        err.should.be.equal(error);
        should.not.exist(res);
        done();
      }

      sandbox.stub(archive, 'archive').yields(error);
      archive.repoBatch(batch, callback);
    });
  })

  describe('processDeleted', function() {
    var repos = [];
    for (var i=0; i<52; i++) {
      repos.push('repo' + i);
    }

    it('should process all batches', function(done) {
      var callback = function(err, res) {
        archive.repoBatch.callCount.should.be.equal(11);
        should.not.exist(err);
        res.batches.should.be.equal(11);
        res.repos.should.be.equal(repos.length);
        done();
      };

      sandbox.stub(archive, 'deletedRepos').returns(Q.resolve(repos));
      sandbox.stub(config, 'get').returns(5);
      sandbox.stub(archive, 'repoBatch').yields();

      archive.processDeleted(config, 'all', callback);

    });

    it('should abort a batch', function() {
      var callback = function(err, res) {
        archive.repoBatch.callCount.should.be.equal(1);
        should.not.exist(res);
        err.should.be.equal(error);
        done();
      };

      sandbox.stub(archive, 'deletedRepos').returns(Q.resolve(repos));
      sandbox.stub(config, 'get').returns(5);
      sandbox.stub(archive, 'repoBatch').yields(error);

      archive.processDeleted(config, 'all', callback);
    });

    it('should not get the list of repos', function() {
      var callback = function(err, res) {
        archive.repoBatch.callCount.should.be.equal(0);
        config.get.callCount.should.be.equal(0);
        should.not.exist(res);
        err.should.be.equal(error);
        done();
      };

      sandbox.stub(archive, 'deletedRepos').returns(Q.reject(error));
      sandbox.spy(archive, 'repoBatch');
      sandbox.spy(config, 'get');

      archive.processDeleted(config, 'all', callback);
    });
  });
});



