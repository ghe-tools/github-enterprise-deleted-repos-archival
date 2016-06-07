# Design

For each Github repository, there is a lot of metadata stored in the databases and 2 Git
repositories:

* the source code
* the wiki (if there are pages).

We make a tarball of those 2 directories only (and not the metadata), and store it in
the long term archival area.

These 2 directories can be extracted from the live instance or from the snapshots made
by the backup-util tool.

The location is sharded and looks like on the live instance:

* /data/repositories/b/nw/b4/da/e0/100000512/538.git
* /data/repositories/b/nw/b4/da/e0/100000512/538.wiki.git

and from the snapshot:

* /data/current/repositories/b/nw/b4/da/e0/100000512/538.git
* /data/current/repositories/b/nw/b4/da/e0/100000512/538.wiki.git

`538` being the repo ID.

Since we are already taking snapshots for backup purpose, we should use the snapshots as the source
to not over burden the GHE running instance.
That introduces an edge case because the snapshot data is few hours older and a repository that is
recently deleted on the live instance might still get updated by the next snapshot. Thus we need
to archive it again on the next run.  Therefore, when scheduling this job, allow for some overlap
between the scheduled interval and the timeframe at which we query for recent deleted repos.
For exanple, if we query for the last 7 days of deleted repos, we should run this tool at an
interval that is less than 7 days.

