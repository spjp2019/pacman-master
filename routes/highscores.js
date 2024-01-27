var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var Database = require('../lib/database');

const opentelemetry = require('@opentelemetry/api');
const tracer = opentelemetry.trace.getTracer('jplatt-apm');
//const tracerRum = opentelemetry.trace.getTracer('jplatt-rum');

// create application/x-www-form-urlencoded parser
var urlencodedParser = bodyParser.urlencoded({ extended: false })

// middleware that is specific to this router
router.use(function timeLog (req, res, next) {
    console.log('Time: ', Date());
    next();
})

router.get('/list', urlencodedParser, function(req, res, next) {
    console.log('[GET /highscores/list]');
    const span = tracer.startSpan('HighScores', {
            attributes: {
                'workflow.name': 'HighScores',
                'userID': 'jonny'
            }
    });
    console.log('FIND_ME!');
span.end();

    span = tracer.startSpan('/list_custom', { 'kind':opentelemetry.SpanKind.SERVER })
    span.setAttribute('endpoint',"get_list");

    Database.getDb(req.app, function(err, db) {
        if (err) {
            console.log("MY_DB_ERROR")
            console.log(err.message)
            span.addEvent(err.message)
            return next(err);
        }

        // Retrieve the top 10 high scores
        var col = db.collection('highscore');
        col.find({}).sort([['score', -1]]).limit(10).toArray(function(err, docs) {
            var result = [];
            if (err) {
                console.log(err);
            }

            docs.forEach(function(item, index, array) {
                result.push({ name: item['name'], cloud: item['cloud'],
                              zone: item['zone'], host: item['host'],
                              score: item['score'] });
                span.setAttribute('name',item['name']);
            });

            res.json(result);
        });
    }, span);
    span.setStatus({ 'code':opentelemetry.SpanStatusCode.OK, 'message':'success' });
    span.end();
});

// Accessed at /highscores
router.post('/', urlencodedParser, function(req, res, next) {
    console.log('[POST /highscores] body =', req.body,
                ' host =', req.headers.host,
                ' user-agent =', req.headers['user-agent'],
                ' referer =', req.headers.referer);
    var payload = 'Event: '.concat(JSON.stringify(req.body), ' ', req.headers.host, ' ',  req.headers['user-agent'], ' ', req.headers.referer)
    const span = tracer.startSpan('/highscores_custom', { 'kind':opentelemetry.SpanKind.SERVER })
    span.setAttribute('endpoint',"post_highscore");
    span.addEvent(payload);
    var userScore = parseInt(req.body.score, 10),
        userLevel = parseInt(req.body.level, 10);

    Database.getDb(req.app, function(err, db) {
        if (err) {
            return next(err);
        }

        // Insert high score with extra user data
        db.collection('highscore').insertOne({
                name: req.body.name,
                cloud: req.body.cloud,
                zone: req.body.zone,
                host: req.body.host,
                score: userScore,
                level: userLevel,
                date: Date(),
                referer: req.headers.referer,
                user_agent: req.headers['user-agent'],
                hostname: req.hostname,
                ip_addr: req.ip
            }, {
                w: 'majority',
                j: true,
                wtimeout: 10000
            }, function(err, result) {
                var returnStatus = '';

                if (err) {
                    console.log(err);
                    returnStatus = 'error';
                } else {
                    console.log('Successfully inserted highscore');
                    returnStatus = 'success';
                }

                res.json({
                    name: req.body.name,
                    zone: req.body.zone,
                    score: userScore,
                    level: userLevel,
                    rs: returnStatus
                });
            });
    }, span);
    span.setStatus({ 'code':opentelemetry.SpanStatusCode.OK, 'message':'success' });
    span.end();
});

module.exports = router;
