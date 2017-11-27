
## Database Creation


CREATE TABLE daily_trending (
             id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
             date           TEXT    NOT NULL,
             data           TEXT     NOT NULL);


             CREATE TABLE `shows` (
             	`id`	INTEGER NOT NULL,
             	`slug`	TEXT NOT NULL UNIQUE,
             	`title`	TEXT NOT NULL,
             	`imdb_id`	TEXT NOT NULL,
             	`trakt_data`	TEXT,
             	`imdb_data`	TEXT,
             	PRIMARY KEY(`id`)
             );

             CREATE TABLE `rankings` (
             	`id`	INTEGER,
             	`show_id`	INTEGER NOT NULL,
             	`rank`	INTEGER NOT NULL,
             	`date`	TEXT NOT NULL,
             	PRIMARY KEY(`id`)
             );
