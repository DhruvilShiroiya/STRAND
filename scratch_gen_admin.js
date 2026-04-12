const jwt = require('jsonwebtoken');
const secret = 'strand_super_secret_change_this_to_something_random_123';
const token = jwt.sign({ userId: 1 }, secret);
console.log(token);
