[![Build Status](http://img.shields.io/travis/ghe-tools/github-enterprise-deleted-repos-archival.svg)](https://travis-ci.org/ghe-tools/github-enterprise-deleted-repos-archival)
[![Coverage Status](https://img.shields.io/coveralls/ghe-tools/github-enterprise-deleted-repos-archival.svg)](https://coveralls.io/github/ghe-tools/github-enterprise-deleted-repos-archival)


# github-enterprise-deleted-repos-archival

This tool preserves user deleted repos into long term storage.  It only preverses
the source code in Git but not the Github data (e.g. pull requests, issues,
repo settings).

In an enterprise settings, the source code belongs to the company and not the users
(employees). Github Enterprise however allows users to delete repos at will resulting
into destruction of intellectual property.

This tool is intended to be running on the server holding the snapshots produced by
`ghe-backup` distributed as part of
[GitHub Enterprise Backup Utils](https://github.com/github/backup-utils).


## Installation

```
$ git clone git@github.com:ghe-tools/github-enterprise-deleted-repos-archival.git
$ cd github-enterprise-deleted-repos-archival
$ npm install
```

Copy config/default-example.json to config/default.json and edit the values as needed

```
$ cp config/default-example.json config/default.json
$ vi config/default.json
```

## Usage

To archive recently deleted repositories run

    $ node src/archive.js --repo=recent

When running for the first time, we want to pick up all repos marked as for deletion.

    $ node src/archive.js --repo=all

Use `--help` switch for more details

To run the smoke test suite:

   $ npm test

To obtain code coverage

    $ npm run cover

Coverage results are stored in `./coverage` folder

To recover a deleted repo:

1. Create a new Github repo first
1. Find the repo in the archive of deleted repos, then untar it
1. Import the source code (just like creating a new repo).

## Cron

It is best to have cron jobs to run it every week.  For example if this app is installed in `/opt/ghe/archival`, the entry for the crontab would look like this:

```
02 02 * * 7 root /opt/ghe/archival/check-process.sh archive.js || NODE_PATH=/opt/ghe/archival/node_modules NODE_CONFIG_DIR=/opt/ghe/archival/config /path-to-nodejs/bin/node /opt/ghe/archival/src/archive.js
```

It runs the archive operation everyday Sunday at 2:02am if it is not currently running


## The config file

* `dir.snapshots` : directory where backup-utils stores snapshots. We look for the `current` directory under `dir.snapshots`
* `dir.archive` : directory where deleted repositories will be copied to for archival
* `github.host` : hostname instance of the instance to process deleted repositories
* `github.port` : SSH administrative port. Don't change it; it is always 122
* `github.timeout`: number of seconds to timeout the SSH connection
* `github.username` : SSH username
* `github.search-query-all` : fetch all repositories that are marked for deletion
* `github.search-query-recent` : fetch all repositories that are marked for deletion from the past N days (this number is in the query itself)
* `ssh-private-key.file` : SSH private key used to connect to GHE
* `ssh-private-key.pass-phrase` : Pass phrase of SSH private key
* `email.sender`: email address to use when sending alert emails.
* `email.recipients`: list of email addresses to send the alert to.
* `log.dir`: log directory location.
* `log.level`: level of details going into the log file.
* `log.retention`: number of log files to keep as they rotate (once a week).
