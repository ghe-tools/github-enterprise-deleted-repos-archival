'use strict';

var nodemailer = require('nodemailer');
var sinon = require('sinon');
var should = require('should');

var helper = require('../src/helper');

describe('helper', function() {
  var sandbox;
  var error = 'Oops! An Error';
  var log = {
    trace: sinon.spy(),
    debug: sinon.spy(),
    info: sinon.spy(),
    warn: sinon.spy(),
    error: sinon.spy(),
    fatal: sinon.spy()
  };

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('paths', function() {
    var dir = '/data/repositories/d/nw/d4/76/a2/100000511/537.git';

    it('should compute all needed paths', function () {
      var paths = helper.paths('23', 'johndoe', 'test-repo', dir,
        '/archive', '/snapshots/current');

      paths.id.should.be.equal('23');
      paths.name.should.be.equal('test-repo');
      paths.owner.should.be.equal('johndoe');
      paths.dir.should.be.equal(dir);
      paths.snapshot.code.should.be.equal('/snapshots/current/repositories/d/nw/d4/76/a2/100000511/537.git');
      paths.snapshot.wiki.should.be.equal('/snapshots/current/repositories/d/nw/d4/76/a2/100000511/537.wiki.git');
      paths.archive.code.should.be.equal('/archive/4663/23_johndoe_test-repo.tar');
      paths.archive.wiki.should.be.equal('/archive/4663/23_johndoe_test-repo.wiki.tar');
    });

    it('should not have funky names', function () {
      var paths = helper.paths('23', 'johndoe', 'déjà-vu-repo', dir,
        '/archive', '/snapshots/current');

      paths.id.should.be.equal('23');
      paths.name.should.be.equal('déjà-vu-repo');
      paths.owner.should.be.equal('johndoe');
      paths.dir.should.be.equal(dir);
      paths.snapshot.code.should.be.equal('/snapshots/current/repositories/d/nw/d4/76/a2/100000511/537.git');
      paths.snapshot.wiki.should.be.equal('/snapshots/current/repositories/d/nw/d4/76/a2/100000511/537.wiki.git');
      paths.archive.code.should.be.equal('/archive/4e58/23_johndoe_deja-vu-repo.tar');
      paths.archive.wiki.should.be.equal('/archive/4e58/23_johndoe_deja-vu-repo.wiki.tar');
    });
  });

  describe('alert()', function(done) {
    it('should fail sending email', function(done) {
      var sendMail = sandbox.stub().yields(error);
      var callback = function(err, res) {
        sendMail.calledOnce.should.be.true();
        err.should.be.equal(error);
        should.not.exist(res);
        done();
      };

      sandbox.stub(nodemailer, 'createTransport', function() {
        return {
          sendMail: sendMail
        }
      });

      helper.alert(['user1@gmail.com', 'user2@gmail.com'], 'a-sender@gmail.com',
        error, log, callback);
    });

    it('should send email to 2 recipients', function(done) {
      var sendMail = sandbox.stub().yields();
      var callback = function(err, res) {
        sendMail.calledOnce.should.be.true();
        sendMail.calledWith({
          from: 'a-sender@gmail.com',
          to: 'user1@gmail.com,user2@gmail.com',
          subject: 'GHE backup of deleted repos dailed!',
          text: 'archive.js encountered the error below.\n\n' + error
        })
        should.not.exist(err);
        done();
      };

      sandbox.stub(nodemailer, 'createTransport', function() {
        return {
          sendMail: sendMail
        }
      });

      helper.alert(['user1@gmail.com', 'user2@gmail.com'], 'a-sender@gmail.com',
        error, log, callback);
    });
  });

});
