var express = require('express');
var loadtest = require('loadtest');
var morgan = require('morgan');
 
var app = express();
 
app.use(morgan('dev'));

app.get('/loadtest/:url/:numRequests', function(req, res) {
    var options = {
        url: req.params.url,
        maxRequests: parseInt(req.params.numRequests),
    };
    loadtest.loadTest(options, function(error, result) {
        if (error) {
            res.status(404).send(error);
        }
        res.send(result);
    });
});

var server = app.listen(7357, function() {
    console.log('cloudr test api listening on port 7357!');
});
server.timeout = 120000;
