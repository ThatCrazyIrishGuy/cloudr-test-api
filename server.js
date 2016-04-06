var express = require('express');
var loadtest = require('loadtest');
var morgan = require('morgan');
var request = require('request');

var app = express();

app.use(morgan('dev'));

app.get('/loadtest/:url/:numRequests', function(req, res) {

    if (req.params.numRequests < 0 || req.params.numRequests > 10000) {
        req.params.numRequests = 100;
    }
    var options = {
        url: req.params.url,
        maxRequests: parseInt(req.params.numRequests),
        concurrency: 10,
        agentKeepAlive: true
    };
    loadtest.loadTest(options, function(error, result) {
        if (error) {
            res.status(404).send(error);
        }
        res.send(result);
    });
});

app.get('/ghost-inspector/run/:testID/:apiKey', function(req, res) {
    var GhostInspector = require('ghost-inspector')(req.params.apiKey.trim());
    var options = {
        //startUrl: 'http://alternate.yourcompany.com'
    };

    GhostInspector.executeTest(req.params.testID, options, function(err, results, passing) {
        if (err) return console.log('Error: ' + err);
        console.log(passing === true ? 'Passed' : 'Failed');
        res.send(results);
    });
});

app.get('/ghost-inspector/previous/:testID/:apiKey', function(req, res) {
    var GhostInspector = require('ghost-inspector')(req.params.apiKey.trim());
    var options = {
        //startUrl: 'http://alternate.yourcompany.com'
    };

    GhostInspector.getTestResults(req.params.testID, options, function(err, results, passing) {
        if (err) return console.log('Error: ' + err);
        res.send(results);
    });
});

app.get('/matrix-test/run/:test/:deployments/:toProject/:user/:session', function(req, res) {
    var user = req.params.user;
    var results = [];
    var resultsCounter = 0;
    var expectedResults = 0;
    var deployments = JSON.parse(req.params.deployments);
    var web = {};
    var databases = {};
    for (key in deployments) {
        if (deployments[key].hasOwnProperty('type')) {
            if (deployments[key].type == 'web') {
                web[key] = deployments[key];
            } else if (deployments[key].type == 'database') {
                databases[key] = deployments[key];
            }
        }
    }
    var databasesComb = [];
    for (dKey in databases) {
        var temp = [];
        for (key in databases[dKey].versions) {
            temp.push(databases[dKey].container + '-' + key);
        }
        databasesComb.push(temp);
    }
    var databasesCart = (databasesComb.length > 0) ? cartProd.apply(this, databasesComb) : [];
    for (key in web) {
        if (databasesCart.length > 0) {
            expectedResults += Object.keys(web[key].versions).length * databasesCart.length;
        } else {
            if (web[key].hasOwnProperty('versions')) {
                expectedResults += Object.keys(web[key].versions).length;
            }
        }
    }
    for (key in web) {
        if (web[key].hasOwnProperty('versions')) {
            for (vKey in web[key].versions) {
                if (databasesCart.length > 0) {
                    databasesCart.forEach(function(databaseSet) {
                        var fakeReq = {};
                        var repoDetails = key.split('/');
                        fakeReq.body = {};
                        fakeReq.session = JSON.parse(req.params.session);
                        fakeReq.body.tag = vKey;
                        fakeReq.body.pullOwner = repoDetails[0];
                        fakeReq.body.pullRepoName = repoDetails[1];
                        fakeReq.body.pullBranch = web[key].branch;
                        fakeReq.body.container = web[key].container;
                        fakeReq.body.toProject = req.params.toProject;
                        fakeReq.body.deployDatabases = true;
                        fakeReq.body.databasesFound = databaseSet;
                        console.log(fakeReq.body);
                        request({ url: "https://api.cloudr.space/matrix-deploy", method: "POST", json: fakeReq }, function(err, response, body) {
                            if (err) throw err;
                            var result = {};
                            var testResults = JSON.parse(body.testResults);
                            var masterVersion = body.masterVersion;
                            result.stack = [];
                            result.stack.push(masterVersion);
                            result.stack.push(databaseSet.filter(function(a) {
                                return a.replace('-', ':')
                            }));
                            result.testResults = testResults;
                            if (result.testResults.totalRequests == result.testResults.totalErrors) {
                                result.grade = 'fail';
                            } else if (result.testResults.totalErrors > 0) {
                                result.grade = 'warning';
                            } else {
                                result.grade = 'pass';
                            }
                            results.push(result);
                            resultsCounter++;
                            console.log(resultsCounter, expectedResults);
                            if (resultsCounter == expectedResults) {
                                res.send(results);
                            }
                        });
                    });
                } else {
                    var fakeReq = {};
                    var repoDetails = key.split('/');
                    fakeReq.body = {};
                    fakeReq.session = JSON.parse(req.params.session);
                    fakeReq.body.tag = vKey;
                    fakeReq.body.pullOwner = repoDetails[0];
                    fakeReq.body.pullRepoName = repoDetails[1];
                    fakeReq.body.pullBranch = web[key].branch;
                    fakeReq.body.container = web[key].container;
                    fakeReq.body.toProject = req.params.toProject;
                    console.log(fakeReq);
                    request({ url: "https://api.cloudr.space/matrix-deploy", method: "POST", json: fakeReq }, function(err, response, body) {
                        if (err) throw err;
                        var result = {};
                        var testResults = JSON.parse(body.testResults);
                        var masterVersion = body.masterVersion;
                        var result = {};
                        result.stack = [];
                        result.stack.push(masterVersion);
                        result.testResults = testResults;
                        if (result.testResults.totalRequests == result.testResults.totalErrors) {
                            result.grade = 'fail';
                        } else if (result.testResults.totalErrors > 0) {
                            result.grade = 'warning';
                        } else {
                            result.grade = 'pass';
                        }
                        results.push(result);
                        resultsCounter++;
                        console.log(resultsCounter, expectedResults);
                        if (resultsCounter == expectedResults) {
                            res.send(results);
                        }
                    });
                }
            }
        }
    }
});

function cartProd(paramArray) {

    function addTo(curr, args) {

        var i, copy,
            rest = args.slice(1),
            last = !rest.length,
            result = [];

        for (i = 0; i < args[0].length; i++) {

            copy = curr.slice();
            copy.push(args[0][i]);

            if (last) {
                result.push(copy);

            } else {
                result = result.concat(addTo(copy, rest));
            }
        }

        return result;
    }


    return addTo([], Array.prototype.slice.call(arguments));
}

var server = app.listen(7357, function() {
    console.log('cloudr test api listening on port 7357!');
});
server.timeout = 120000;
