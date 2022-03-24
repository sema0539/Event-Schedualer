var Sequelize = require('sequelize');
var bcrypt = require('bcrypt');

var sequelize;
if (process.env.DATABASE_URL) {
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect:'postgres',
    protocol:'postgres'
  });
} else {
  sequelize = new Sequelize('igru', 'postgres', 'fish', {
    dialect:'postgres',
    protocol:'postgres'
  });
}

var User = sequelize.define('user', {
  username: {
    type: Sequelize.STRING,
    unique: true,
    allowNull: false
  },
  email: {
    type: Sequelize.STRING,
    unique: true,
    allowNull: false
  },
  password: {
    type: Sequelize.STRING,
    allowNull: false
  },
  first_name: {
    type: Sequelize.STRING,
    allowNull: false
  },
  last_name: {
    type: Sequelize.STRING
  },
  saved_events: {
    type: Sequelize.ARRAY(Sequelize.INTEGER)
  },
  admin: {
    type: Sequelize.BOOLEAN
  }
}, {
  hooks: {
    beforeCreate: (user) => {
      const salt = bcrypt.genSaltSync();
      user.password = bcrypt.hashSync(user.password, salt);
    }
  }
});

User.prototype.validPassword = function(password) {
  return bcrypt.compareSync(password, this.password);
}
User.prototype.addEvent = function(event_id) {
  this.saved_events.push(event_id); 
}
User.prototype.removeEvent = function(event_id) {
  var index = this.saved_events.indexOf(event_id);
  if (index > -1) {
    this.saved_events.splice(index, 1);
  }
}

sequelize.sync()
  .then(() => console.log('Users table has been successfully created, if it doesn\'t exist'))
  .catch(error => console.log('Error: ', error));

module.exports = User;
