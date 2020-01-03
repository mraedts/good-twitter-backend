const express = require('express');
const app = require('express')();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const twitterAPI = require('./fetcher.js');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const logger = require('morgan');
require('colors');

const port = 3001;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(logger('tiny'));
app.use(cors());

app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'frontend')));

app.get('/', function(req, res) {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

app.get('/api/first_tweets', function(req, res) {
  twitterAPI
    .getInitialTweets()
    .then(response => {
      res.json(response.data);
    })
    .catch(err => {
      console.error(err);
      res.status(err.statusCode);
      res.json(err);
    });
});

app.post('/api/favorite/create/:id', (req, res) => {
  twitterAPI
    .tweetInteraction(req.params.id.toString(), 'fav')
    .then(result => {
      res.json(result);
    })
    .catch(err => {
      console.log(err);
      res.status(err.statusCode);
      res.json(err);
    });
});

app.post('/api/statuses/retweet/:id', (req, res) => {
  twitterAPI
    .tweetInteraction(req.params.id.toString(), 'rt')
    .then(result => {
      console.log(result);
      res.json(result);
    })
    .catch(err => {
      console.log(err);
      res.status(err.statusCode);
      res.json(err);
    });
});

app.post('/api/favorite/destroy/:id', (req, res) => {
  twitterAPI
    .tweetInteraction(req.params.id.toString(), 'fav', true)
    .then(result => {
      console.log(result);
      res.json(result);
    })
    .catch(err => {
      console.log(err);
      res.status(err.statusCode);
      res.json(err);
    });
});

app.post('/api/statuses/unretweet/:id', (req, res) => {
  twitterAPI
    .tweetInteraction(req.params.id.toString(), 'rt', true)
    .then(result => {
      console.log(result);
      res.json(result);
    })
    .catch(err => {
      console.log(err);
      res.status(err.statusCode);
      res.json(err);
    });
});

app.post('/api/interaction_count', (req, res) => {
  twitterAPI
    .getHydrated(req.body)
    .then(response => {
      res.json(response);
    })
    .catch(err => {
      res.status(err.statusCode);
      res.json(err);
    });
});

io.on('connection', function(socket) {
  const asyncWrapper = async () => {
    const stream = await twitterAPI.getStreamObj(socket);

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
