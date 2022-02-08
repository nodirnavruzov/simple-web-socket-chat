// func check is empty obj
module.exports = function (obj) {
  for (const prop in obj) {
    if (obj.hasOwnProperty(prop)) {
      return false
    }
  }
  return true
  // Also this is good.
  // returns 0 if empty or an integer > 0 if non-empty
  // return Object.keys(obj).length;
}
