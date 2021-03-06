
// Mongo configuration
if(process.env.VCAP_SERVICES){ // Appfog
    var env = JSON.parse(process.env.VCAP_SERVICES);
    var mongo = env['mongodb-1.8'][0]['credentials'];
    GLOBAL.mongo_host = mongo.hostname;
    GLOBAL.mongo_port = mongo.port;
}
else { // Local
    GLOBAL.mongo_host = "localhost"
    GLOBAL.mongo_port = "27017";
}

/**
 * Module dependencies.
 */

var express = require('express')
  , routes = require('./routes')
  , user = require('./routes/user')
  , question = require('./routes/question')
  , http = require('http')
  , path = require('path')
  ,cookieSessions = require('./cookie-sessions')
  ,expressMiddlewares = require('./express-middlewares');

var app = express();

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(express.cookieParser('Muse is the best band'));
app.use(cookieSessions('sessionData'));

// ## CORS middleware
app.use(expressMiddlewares.allowCrossDomain);
// Check that user is loggedIn
app.use(expressMiddlewares.isUserLoggedIn);

app.use(app.router);

app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

app.get('/', routes.index);
app.post('/users', user.create);
app.post('/users/login', user.login);
app.post('/users/signout', user.signout);
app.get('/users/isloggedin', user.isloggedin);

app.post('/questions', question.submitQuestion);
app.get('/questions/user', question.getAllUserQuestions);
app.post('/questions/vote', question.voteQuestion);
app.get('/questions/rand', question.getRandomQuestion);

http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});
