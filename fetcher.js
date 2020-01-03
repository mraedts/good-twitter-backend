require('dotenv').config();
const Twit = require('twit');
const colors = require('colors');

const twit = new Twit({
  consumer_key: process.env.API_KEY,
  consumer_secret: process.env.API_SECRET,
  access_token: process.env.TOKEN,
  access_token_secret: process.env.TOKEN_SECRET
});

let friendArray = [];

// const user = getCurrentUser();

// function getCurrentUser() {
//   twit.get('account/verify_credentials', (err, data) => {
//     if (err) {
//       console.log(err);
//     } else {
//       return data;
//     }
//   });

// }

async function getStreamObj(socket) {
  const friends = await getFriendList();
  const stream = twit.stream('statuses/filter', {
    follow: friends,
    tweet_mode: 'extended'
  });

  stream.on('tweet', tweet => {
    if (
      (tweet != undefined &&
        tweet.retweeted_status == undefined &&
        tweet.in_reply_to_status_id == null &&
        tweet.in_reply_to_user_id == null) ||
      isRetweetedByFollow(tweet, friends)
    ) {
      socket.emit('tweet', tweet);
      console.log(`tweet found | ${tweet.id_str}`.green);
    }
  });

  return stream;
}

async function tweetInteraction(ID, interactType, undo) {
  async function favoriteTweet(id) {
    const response = await twit
      .post('favorites/create', { id: id })
      .catch(err => {
        console.error(err);
        const error = {
          code: err.code,
          message: err.message,
          statusCode: err.statusCode
        };
        throw error;
      });
    return response;
  }

  async function retweet(id) {
    const response = await twit
      .post('statuses/retweet', { id: id })
      .catch(err => {
        console.error(err);
        const error = {
          code: err.code,
          message: err.message,
          statusCode: err.statusCode
        };
        throw error;
      });
    return response;
  }

  async function unfavoriteTweet(id) {
    const response = await twit
      .post('favorites/destroy', { id: id })
      .catch(err => {
        console.error(err);
        const error = {
          code: err.code,
          message: err.message,
          statusCode: err.statusCode
        };
        throw error;
      });
    console.log(response);
    return response;
  }

  async function undoRetweet(id) {
    const response = await twit
      .post('statuses/unretweet', { id: id })
      .catch(err => {
        console.error(err);
        const error = {
          code: err.code,
          message: err.message,
          statusCode: err.statusCode
        };
        throw error;
      });
    return response;
  }

  let response;
  if (interactType === 'fav') {
    if (undo) {
      response = await unfavoriteTweet(ID);
    } else {
      response = await favoriteTweet(ID);
    }
  } else if (interactType === 'rt') {
    if (undo) {
      response = await undoRetweet(ID);
    } else {
      response = await retweet(ID);
    }
  }
  return response;
}

function getFriendList() {
  return new Promise(function(resolve, reject) {
    if (friendArray.length > 0) {
      resolve(friendArray);
    }
    twit.get('friends/ids', { screen_name: 'e_dts_' }, (err, data) => {
      if (err) {
        reject(err);
      } else {
        let ids = [];
        data.ids.forEach(id => {
          ids.push(id);
        });
        resolve(ids);
        friendArray = ids;
      }
    });
  });
}

function getIDs(tweets) {
  let ids = [];
  tweets.forEach(tweet => {
    ids = [...ids, tweet.id];
  });
  return ids;
}

async function getInitialTweets() {
  const response = await twit
    .get('statuses/home_timeline', { count: 50, tweet_mode: 'extended' })
    .catch(err => {
      console.error(err);
      const error = {
        code: err.code,
        message: err.message,
        statusCode: err.statusCode
      };
      throw error;
    });
  return response;
}

async function getHydrated(ids) {
  try {
    function createObjects(results) {
      let updatedTweetObjs = [];
      results.forEach(result => {
        result.data.forEach(tweet => {
          updatedTweetObjs.push({
            id: tweet.id,
            id_str: tweet.id_str,
            favs: tweet.favorite_count,
            retweets: tweet.retweet_count
          });
        });
      });
      return updatedTweetObjs;
    }

    function makePromises(ids) {
      let locIds = [];
      let i = 0;
      let n = i + 99;

      if (idsIndexed > 0) {
        i = idsIndexed;
        n = i + 100;
      }

      for (i; i <= n; i++) {
        if (ids[idsIndexed] != undefined) {
          locIds.push(ids[i]);
        }
        idsIndexed++;
      }

      promises.push(
        twit.get('statuses/lookup', { id: locIds, tweet_mode: 'extended' })
      );

      if (idsIndexed < ids.length) makePromises(ids);
    }

    if (ids.length <= 100) {
      const response = await twit.get('statuses/lookup', {
        id: ids,
        tweet_mode: 'extended'
      });
      return createObjects([response]);
    }

    let promises = [];
    let idsIndexed = 0;

    makePromises(ids);
    const results = await Promise.all(promises);
    return createObjects(results);
  } catch (err) {
    throw err;
  }
}

// getHydrated(testIDs);

function isRetweetedByFollow(tweet, friends) {
  if (
    friends.includes(tweet.user.id) &&
    tweet.in_reply_to_status_id == null &&
    tweet.in_reply_to_user_id == null
  ) {
    return true;
  } else return false;
}

module.exports = {
  getHydrated,
  getInitialTweets,
  getFriendList,
  tweetInteraction,
  getStreamObj
};
