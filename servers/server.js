// after using the default tutorial on socket.io from heroku
// i added some cleaning up: https://scotch.io/tutorials/how-to-deploy-a-node-js-app-to-heroku
'use strict';

//configuration
global.__base = __dirname + '/../'; // https://gist.github.com/branneman/8048520
require('dotenv').config(); // required for local development. on glitch.com this happens per defaults

//https://stackoverflow.com/questions/11580961/sending-command-line-arguments-to-npm-script
//console.log('process.argv', process.argv);
//control the debug level from CLI input https://github.com/winstonjs/winston#logging-levels
let level= "error";
process.argv.forEach(function(item, index, array) {
   if(item=="debug")
      level= "debug";
})
//include winston logger
const winston = require('winston'); // used version 3 RC 1
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
     new winston.transports.Console({
     format: winston.format.simple()})
  ]
});
//DB Hanlding with SQlite:
var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database(global.__base+'data/db.sqlite');

// https://github.com/vankasteelj/trakt.tv
const Trakt = require('trakt.tv');
let trakt= null;
const imdb = require('imdb-api');

const express= require('express');
let app = express();
let server = require('http').Server(app);


//for file operations
const fs = require('fs');
const path = require('path');

//deliver static assets such as CSS & JS
app.use('/static', express.static('public'));
app.use('/data', express.static('data'));
// set the view engine to ejs https://scotch.io/tutorials/use-ejs-to-template-your-node-application
app.set('view engine', 'ejs');

const PORT = process.env.PORT || 3100; //use env.PORT on heroku or 3100 on local ;-)

// Frontend 0.1
const INDEX = path.join(__dirname, '../views/index.html');


server.listen(PORT, () => logger.info(`Listening on ${ PORT }`));

initTrak();


app.use('/static', express.static('public'));

app.get('/', function(req, res) {
     logger.info("root has been called");

    res.render('pages/index');

 });

app.get('/showJson', function(req, res) {
     logger.info("server has started");
     getTrendingShows();

     //getPopularShows();
     //getIMDB();
    res.send("<a href='http://jsonviewer.stack.hu/#http://auspicious-salesman.glitch.me/api/history.json''>let us see some data</a>");

 });

 app.get('/api/trending', function(req, res) {
      logger.info("server has started");
      // GUI STUFF NOW

        getData().then(function (data) {
           console.log("all DB Data:", data);
           res.send(data);
        })
  });

  
app.get('/api/history.json', function(req, res) {
      logger.info("file history api is delivered");
      // GUI STUFF NOW
      
      //https://stackoverflow.com/questions/14882310/how-to-implement-file-download-functionality-using-node-js-and-express-so-that
      res.attachment('history.json')
  
        getData().then(function (data) {
           console.log("all DB Data as file :", data);
          res.setHeader('Content-Type', 'application/octet-stream')
          res.end(JSON.stringify(data, null, 2), 'utf8')
        })
  });



app.get('/chart_cron', function(req, res) {
     //console.log(req.query.hash, process.env.CRON_KEY);
     console.info("cronjob is called with hash:", req.query.hash);

    if(process.env.CRON_KEY==req.query.hash) {
       res.write("cronjob can be executed has write KEY");
       //getTrendingShows();
       getTrendingShows().then(shows => {
          //now save all the data we get
         saveCharts(shows);
         saveChartsToDB(shows);
         res.write('shows are saved');
         res.end();
       }, err => {
         logger.log("ERROR in /chart_cron", err);
         res.send('could not save shows');
       }
       );
    } else {
      res.send("Wrong hash key is provided");
    }
  });

app.get('/getTrending', function(req, res) {
     //console.log(req.query.hash, process.env.CRON_KEY);

       getTrendingShows().then(shows => {

         //console.log('shows:', shows[0].show.ids.slug);
         //saveChartsToDB(shows);
         res.end();
       }, err => {
         logger.log("ERROR in /chart_cron", err);
         res.send('could not save shows');
       }
       );
  });

app.get('/getCharts', function(req, res) {
    const fileName= global.__base+'data/data.json';
     let fileContent= require(fileName);
      console.log("file content", fileContent);
  });

app.get('/db', function(req, res) {
  });



//logger.info(app._router.stack);
//process.exit(1);


function initTrak() {

   let options = {
     client_id: process.env.TRAKT_CLIENT_ID,
     client_secret: process.env.TRAKT_CLIENT_SECRET,
     redirect_uri: "https://tvcharts.herokuapp.com/",   // defaults to 'urn:ietf:wg:oauth:2.0:oob'
     api_url: null,        // defaults to 'https://api.trakt.tv'
     useragent: null,      // defaults to 'trakt.tv/<version>'
     pagination: true      // defaults to false, global pagination (see below)
   };

   trakt = new Trakt(options);
   //logger.info("trakt initiated", trakt);


}

function getTodayShows() {
   trakt.calendars.all.shows({
    start_date: '2017-11-10',
    days: '7',
    extended: 'full'
   }).then(shows => {
       // Contains Object{} response from API (show data)
       logger.info("the shows", shows);
   }, err => {
       logger.info("error shows", err);
   });
}

function getTrendingShows() {
   // https://stackoverflow.com/questions/26150232/resolve-javascript-promise-outside-function-scope
  var promiseResolve, promiseReject;


  //return asynch https://developer.ibm.com/node/2016/08/24/promises-in-node-js-an-alternative-to-callbacks/
  var ret= new Promise(function(resolve, reject){
      promiseResolve = resolve;
      promiseReject = reject;
  });

   trakt.shows.trending({ page: 1, limit: 100, extended:'full' }).then(shows => {
       // Contains Object{} response from API (show data)
       //logger.info("the shows", shows);
       //logger.info("get trending shows!");
       shows.data.map(function(curr, index, array) {
          //logger.info("the show", curr);
       })
        promiseResolve(shows.data);
   }, err => {
       logger.info("error shows", err);
       promiseReject("error loading shows", err);
   });

  return ret;
}

function getPopularShows() {

  // https://stackoverflow.com/questions/26150232/resolve-javascript-promise-outside-function-scope
  var promiseResolve, promiseReject;


  //return asynch https://developer.ibm.com/node/2016/08/24/promises-in-node-js-an-alternative-to-callbacks/
  var ret= new Promise(function(resolve, reject){
      promiseResolve = resolve;
      promiseReject = reject;
  });


   trakt.shows.popular().then(shows => {
       // Contains Object{} response from API (show data)
       logger.info("get popular shows!");

       shows.data.map(function(curr, index, array) {
          logger.info("the show", curr);
       })
       promiseResolve(shows);
   }, err => {
       logger.info("error shows", err);
       promiseReject("error loading shows", err);
   });

  return ret;
}

function getIMDB() {
   // https://docs.worrbase.com/node/imdb-api/
   imdb.getById('tt0090190', {apiKey: process.env.IMDB_API_KEY, timeout: 30000}).then( data => {
         logger.info("data from IMDB:", data);
   }).catch(console.log);
}


function saveCharts(chartsData) {
      const fileName= global.__base+'data/data.json';

      //read that file https://stackoverflow.com/questions/35389060/read-json-file-content-with-require-vs-fs-readfile
      var data = require(fileName);


      //console.log("loaded file data:", data);
      var newData= {};
      newData.date=dateTimeNow();
      newData.data= chartsData;
      console.log("add data:", newData);
      data.push(newData);
      //console.log("write file data:", data);

      var json = JSON.stringify(data);
      //console.log("JSON looks like:", json);

      fs.writeFile(fileName, json, 'utf8', (err) => {
         if (err) throw err;
         //console.log('The file has been saved!', err);
         let fileContent= require(fileName);
         //console.log("file content", fileContent);
      });
}

function saveChartsToDB(chartsData) {
   processShows(chartsData, dateTimeNow());
}



/* HELPER functions */
  function dateNow() {
     var today = new Date();
  var dd = formatBelowTen(today.getDate());
  var mm = formatBelowTen(today.getMonth()+1); //January is 0!

  var yyyy = today.getFullYear();
  return dd+'/'+mm+'/'+yyyy;
 }

  function dateTimeNow() {
  var today = new Date();
  var dd = formatBelowTen(today.getDate());
  var mm = formatBelowTen(today.getMonth()+1); //January is 0!
  //console.log("month:"+mm);
  var yyyy = today.getFullYear();
  var hh = formatBelowTen(today.getHours());
  var ii = formatBelowTen(today.getMinutes());
  var ss = formatBelowTen(today.getSeconds());

  return dd+'/'+mm+'/'+yyyy+' '+hh+":"+ii+":"+ss;
 }

function formatBelowTen(number) {
  if(number<10){
      number='0'+number;
  }
  return number;
}

function createDB() {
  db.run("CREATE TABLE daily_trending ( \
               id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, \
               date           TEXT    NOT NULL, \
               data           TEXT     NOT NULL);" ,function(){
        console.log(this);
      })
      console.log("db creaction");
}

//try
//fromJSONToSqlite();


function fromJSONToSqlite() {
   const fileName= global.__base+'data/data.json';

   //read that file https://stackoverflow.com/questions/35389060/read-json-file-content-with-require-vs-fs-readfile
   var data = require(fileName);

   data.forEach(function (elem, index){
      //console.log(elem.data.length + ' comes at ' + index);
      //insertTrendingData(elem.data, elem.date);
      processShows(elem.data, elem.date); // test only
   });

}

// TODO: let's continue here
function insertTrendingData(data, date) {

  // insert http://www.sqlitetutorial.net/sqlite-nodejs/insert/
  db.run("INSERT INTO daily_trending ('date', 'data') VALUES (?, ?)", [date, JSON.stringify(data)], function(err) {
    if (err) {
      return console.log(err.message);
    }
    // get the last insert id
    console.log("A row has been inserted with rowid ${this.lastID}");
    //now insert the shows if not already in the DB
    processShows(data, date);
  });
}

function processShows(data, date) {
   //crawl to all shows
   data.forEach(function (elem, index) {
         //console.log(elem.show.title, date);

         /* TODO: also grab the data from imdb
         // https://docs.worrbase.com/node/imdb-api/
         imdb.getById(elem.show.ids.imdb, {apiKey: process.env.IMDB_API_KEY, timeout: 30000}).then( data => {
               console.log("("+index+")data from IMDB:", data.title);
         }).catch(console.log);
         */
         insertShow(elem.show, index+1, date); // index+1 because we need a ranking which starts at 1 and not 0 ! ;-)
   });
}

function insertShow(show, rank, date) {
   //console.log(show);
   // insert on conflict ignore because 'slug' is unique! https://stackoverflow.com/questions/2779823/sqlite-query-to-insert-a-record-if-not-exists
   //console.log("INSERT OR IGNORE INTO shows ('id', 'slug', 'title', 'imdb_id', 'trakt_data') VALUES ('"+show.ids.trakt+"', '"+show.ids.slug+"', '"+show.title+"', '"+show.ids.imdb+"', '"+JSON.stringify(show)+"')");

   //we do have legacy support for this data, and old data need to be updated

   updateShow(show, rank, date).then(function (data) {
      console.log("data is updated to a new extended level", data);
   }).catch(function (error) {
      // if update fails it means that there is already a dataset with extended data
      //console.log("error:", error);

      // insert http://www.sqlitetutorial.net/sqlite-nodejs/insert/
      db.run("INSERT OR IGNORE INTO shows ('id', 'slug', 'title', 'imdb_id', 'trakt_data') VALUES (?, ?, ?, ?, ?)", [show.ids.trakt, show.ids.slug, show.title,show.ids.imdb,JSON.stringify(show)], function(err) {
        if (err) {
         return console.log(err.message);
        }
        // get the last insert id
        console.log("A row has been inserted with rowid: "+this.lastID);
      });
   });

   // now insert the index for the charts ranking
  insertRanking(show.ids.trakt, rank, date);


}


function updateShow(show, data, rank) {

   var promiseResolve, promiseReject;
   //return asynch https://developer.ibm.com/node/2016/08/24/promises-in-node-js-an-alternative-to-callbacks/
   var ret= new Promise(function(resolve, reject){
      promiseResolve = resolve;
      promiseReject = reject;
   });

   var insertFlag= true; // this flag is if no update is needed
   //now test if the show already exists
   db.all("SELECT * from shows WHERE imdb_id='"+show.ids.imdb+"'", (err, result) => {
      if (err) {
      promiseReject("an error on SELECT happend: "+err.message);
      //console.log(err.message);
     }

     // if there is no result
     if(result.length==0)
         promiseReject("no dataset select has to be a new one so insert it");
      else {
         result= result[0]; // all returnes an array, as we just selected one item let's reset it to this one object
      }

     //TODO: make the promise nicer for the receiving function!
     if(typeof result.id=="number") {
        // after we receive an dataset we have to look inside the flat JSON Data to see if it needed to be updated
        var data= JSON.parse(result.trakt_data);
        //console.log("trakt_data", data);
        //console.log("trakt_data overview", typeof data.overview);

        // update those dataset where overview from extended data is missing
        if(typeof data.overview=="undefined") {
           let data = [JSON.stringify(show), result.id];
           let sql = `UPDATE shows
                        SET trakt_data = ?
                        WHERE id = ?`;

            db.run(sql, data, function(err) {
            if (err) {
              console.error(err.message);
              promiseReject("an error on UPDATE happend: "+err.message);
            }
            console.log('Row(s) updated:', this.changes);
            if(parseInt(this.changes)==1)
               promiseResolve("update has been made", this.changes);
            });
        } else {
           promiseReject("needs to insert");
        }
     } else {
        promiseReject("needs to insert");
     }

  });

  return ret;
}

function insertRanking(id, rank, date) {
   //console.log("insert Ranking:", arguments);

   db.run("INSERT INTO rankings ('show_id', 'rank', 'date') VALUES (?, ?, ?)", [id, rank, date], function(err) {
     if (err) {
      return console.log(err.message);
     }
     // get the last insert id
     console.log("A rank has been inserted with rowid: "+this.lastID);
   });

}

function getData() {
   var promiseResolve, promiseReject;
   //return asynch https://developer.ibm.com/node/2016/08/24/promises-in-node-js-an-alternative-to-callbacks/
   var ret= new Promise(function(resolve, reject){
       promiseResolve = resolve;
       promiseReject = reject;
   });

   // GROUP_CONCAT is tricky because you can not sort the results, they come arbitrary. http://www.sqlite.org/lang_aggfunc.html#groupconcat
   var query= "SELECT shows.title, GROUP_CONCAT(ranks.rank || '-' || ranks.date) AS rank_merger,GROUP_CONCAT(ranks.date) FROM shows LEFT JOIN ( \
                  SELECT rank, date, show_id \
                  FROM rankings \
                  ORDER BY date \
               ) ranks On shows.id=ranks.show_id GROUP BY shows.id ORDER BY ranks.date";

   var results= new Array();
   // function is asynch but not Promise based, http://www.sqlitetutorial.net/sqlite-nodejs/query/
   db.each(query, (err, result) => {

      if (err) {
      console.log(err.message);
      promiseReject("error getData()", err);
     }

      // now let's build a nice result object
      var resultElem= { title: result.title, data: [] };
      //console.log("result:",result.title, result.rank_merger);

      // we merged the rank and the date together to 'flatten' the result, now let's sort this
      var rankValues= sortRank_merger(result.rank_merger);
      rankValues.forEach(function (elem, index, array) {
         var elem= elem.split("-");
         resultElem.data.push({date: getDate(elem[1]).toUTCString(), rank: parseInt(elem[0])});
      })
      //console.log("result:",result.title, rankValues);
      //console.log("result:",result.title, resultElem);
         results.push(resultElem);
         //console.log(results.length);
      }, () => {
         //console.log("RESULTS", results);
         promiseResolve(results);
      });
      //return a promise
      return ret;
}

function getDate(thisDateFormat) {
   //compair dates:
   var day_time=thisDateFormat.split(' '); // 24/30/2017 22:30:18
   var day= day_time[0].split("/");
   var time= day_time[1].split(":");
   //console.log(day, time, new Date(day[2], day[1]-1, day[0], time[0], time[1], time[2]));

   //BUG in DB month 30 = 11 = November
   if(day[1]==30)
      day[1]= 11;

   return new Date(day[2], day[1]-1, day[0], time[0], time[1], time[2]); //please put attention to the month (parts[0]), Javascript counts months from 0: January - 0, February - 1,
}

// this function is a workaround for the arbitrary GROUP_CONCAT result from SqLite
function sortRank_merger(colRankMerger) {
   //console.log("input:", colRankMerger);
   var values= colRankMerger.split(",").sort(function (a, b) {
      //console.log(a, b);
         var sortdata_a= a.split("-");
         var sortdata_b= b.split("-");
         var date_a= getDate(sortdata_a[1]); // compair the dates e.g 14-24/30/2017 22:30:18 and 43-25/30/2017 22:30:36 first value is not needed
         var date_b= getDate(sortdata_b[1]);
         /*
            console.log(date_a.toUTCString(), date_b.toUTCString());
         if(date_b<date_a)
            console.log("b is größer a", date_b, date_a);
         */
         if(date_b<date_a)
            return 1;
         else
            return -1;
      });
   return values;
}