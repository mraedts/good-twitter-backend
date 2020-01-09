const express = require('express');
const app = require('express')();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const twitterAPI = require('./fetcher.js');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const logger = require('morgan');
const passport = require('passport');
const TwitterStrategy = require('passport-twitter').Strategy;
const session = require('express-session');
const User = require('./models/user.js').User;
const mongoose = require('mongoose');
const MongoStore = require('connect-mongo')(session);
const sharedSession = require('express-socket.io-session');
const db = require('./db.js');

require('colors');

const port = 5000;

mongoose.connect('mongodb://192.168.3.48:27017/defaultdb', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const mySession = session({
  secret: 'cats',
  resave: true,
  saveUninitialized: true,
  store: new MongoStore({
    url: 'mongodb://192.168.3.48:27017/defaultdb',
    useNewUrlParser: true,
    useUnifiedTopology: true,
    ttl: 60 * 2
  })
});

app.use(cors());
app.use(mySession);

passport.use(
  new TwitterStrategy(
    {
      consumerKey: 'GlKBpjXC1JzltlB1YQ9ImxRQ0',
      consumerSecret: 'rKreDau6xGtkQLRazTQy2HWGxYGJqTzshfBHbtJTmnwmMSeg1R',
      callbackURL: 'http://localhost:5000/auth/twitter/callback'
    },
    async function(token, tokenSecret, profile, cb) {
      const user = new User({
        id: profile.id,
        token: token,
        tokenSecret: tokenSecret
      });

      if (await User.exists({ id: profile.id.toString() })) {
        cb(null, profile);
        return;
      } else {
        await user.save(err => {
          if (err) {
            console.log(err);
          }
        });
      }

      cb(null, profile);
    }
  )
);

passport.serializeUser((user, callback) => {
  callback(null, user);
});

passport.deserializeUser((obj, callback) => {
  callback(null, obj);
});

app.use(passport.initialize());

app.get('/', function(req, res) {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

app.delete('/auth/twitter/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      res.status(404).json({ statusCode: 404, errorMessage: err });
    } else {
      res.status(200).json({ statusCode: 200 });
    }
  });
});

app.get('/auth/twitter/status', (req, res) => {
  res.json(req.session);
});

app.get('/auth/twitter', passport.authenticate('twitter'));

app.get(
  '/auth/twitter/callback',
  passport.authenticate('twitter', {
    successRedirect: '/',
    failureRedirect: '/auth/failure'
  }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect('/');
  }
);

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(logger('dev'));

app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'frontend')));

app.get('/api/first_tweets', function(req, res) {
  async function asyncWrapper() {
    try {
      const id = req.session.passport.user.id;
      const tokens = await db.findUserById(id, User);
      const response = await twitterAPI.getInitialTweets(tokens[0], tokens[1]);
      res.json(response.data);
    } catch (err) {
      console.error(err);
      res.status(err.statusCode || 404);
      res.json(err);
    }
  }
  asyncWrapper();
});

app.post('/api/favorite/create/:id', (req, res) => {
  async function asyncWrapper() {
    try {
      const id = req.session.passport.user.id;
      const tokens = await db.findUserById(id, User);
      const response = await twitterAPI.tweetInteraction(
        req.params.id.toString(),
        'fav',
        tokens
      );
      res.json(response);
    } catch (err) {
      console.error(err);
      res.status(err.statusCode || 404);
      res.json(err);
    }
  }

  asyncWrapper();
});

app.post('/api/statuses/retweet/:id', (req, res) => {
  async function asyncWrapper() {
    try {
      const id = req.session.passport.user.id;
      const tokens = await db.findUserById(id, User);
      const response = await twitterAPI.tweetInteraction(
        req.params.id.toString(),
        'rt',
        tokens
      );
      res.json(response);
    } catch (err) {
      console.error(err);
      res.status(err.statusCode || 404);
      res.json(err);
    }
  }

  asyncWrapper();
});

app.post('/api/favorite/destroy/:id', (req, res) => {
  async function asyncWrapper() {
    try {
      const id = req.session.passport.user.id;
      const tokens = await db.findUserById(id, User);
      const response = await twitterAPI.tweetInteraction(
        req.params.id.toString(),
        'fav',
        tokens,
        true
      );
      res.json(response);
    } catch (err) {
      console.error(err);
      res.status(err.statusCode || 404);
      res.json(err);
    }
  }

  asyncWrapper();
});

app.post('/api/statuses/unretweet/:id', (req, res) => {
  async function asyncWrapper() {
    try {
      const id = req.session.passport.user.id;
      const tokens = await db.findUserById(id, User);
      const response = await twitterAPI.tweetInteraction(
        req.params.id.toString(),
        'rt',
        tokens,
        true
      );
      res.json(response);
    } catch (err) {
      console.error(err);
      res.status(err.statusCode || 404);
      res.json(err);
    }
  }

  asyncWrapper();
});

app.post('/api/interaction_count', (req, res) => {
  async function asyncWrapper() {
    try {
      const id = req.session.passport.user.id;
      const tokens = await db.findUserById(id, User);
      const response = await twitterAPI.getHydrated(req.body, tokens);
      res.json(response);
    } catch (err) {
      res.status(err.statusCode || 404);
      res.json(err);
    }
  }
  asyncWrapper();
});

io.use(sharedSession(mySession));

io.on('connection', function(socket) {
  const asyncWrapper = async () => {
    const id = socket.handshake.session.passport.user.id;
    const screenName = socket.handshake.session.passport.user.username;
    const tokens = await db.findUserById(id, User);
    const stream = await twitterAPI.getStreamObj(socket, tokens, screenName);
    socket.on('disconnect', () => {
      console.log('client disconnected');
      stream.stop();
    });
  };
  asyncWrapper();
});

http.listen(port, function() {
  console.log(`listening on localhost:${port}`);
});
