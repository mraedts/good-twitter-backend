async function findUserById(id, User) {
  let tokens = [];
  await User.findOne({ id: id }, (err, res) => {
    if (err) {
      throw err;
    } else {
      tokens[0] = res.token;
      tokens[1] = res.tokenSecret;
    }
  });
  return tokens;
}

module.exports = { findUserById };
