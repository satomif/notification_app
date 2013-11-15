(function() {

  return {
    events: {
      'app.activated': 'init',
      'click #send-msg': 'sendMsg',
      'click a.close': 'onClickClose',
      'keypress input.message': 'onMessageInputKeyPress',
      'notification.notificationMessage': 'handleIncomingMessage',
      'click .toadmin': 'onToadminClick',
      'click .cancel': 'onCancelClick'
    },

    requests: {
      'sendMsg': function(text, groupId) {
        return {
          url: '/api/v2/apps/notify',
          type: 'POST',
          data: {
            event: 'notificationMessage',
            body: {
              text: text,
              groupId: groupId,
              sender: this.currentUser().email(),
              senderName: this.currentUser().name()
            },
            app_id: 0
          }
        };
      },

      'getAssignableGroups': {
        url: '/api/v2/groups/assignable.json',
        type: 'GET'
      },

      'getMyGroups': function() {
        return {
          url: '/api/v2/users/%@/group_memberships.json'.fmt(this.currentUser().id()),
          type: 'GET'
        };
      }
    },

    init: function() {
      this.ajax('getMyGroups').done(function(data) {
        var groupMemberships = data.group_memberships;
        this.myGroupIds = _.map(groupMemberships, function(group) {
          return group.group_id;
        });
      }.bind(this));

      this.ajax('getAssignableGroups').done(function(data) {
        this.groups = {};

        _.each(data.groups, function(group) {
          this.groups[group.name] = group.id;
        }.bind(this));
      }.bind(this));

      this.drawInbox();
    },

    drawInbox: function() {
      var isAdmin = (this.currentUser().role() === "admin");
      this.switchTo('inbox', {
        isAdmin: isAdmin
      });
    },

    onToadminClick: function(event) {
      event.preventDefault();
      this.switchTo('admin');
      this.$('input.groups').autocomplete({
        source: _.keys(this.groups)
      });
    },

    onCancelClick: function(event) {
      this.init();
    },

    sendMsg: function() {
      var message = this.$('textarea.message').val();
      var groupName = this.$('input.groups').val();
      var groupId = this.groups[groupName];
      this.ajax('sendMsg', this.markdown(message), groupId);
      this.$('textarea.message').val("");
      this.init();
    },

    onMessageInputKeyPress: function(event) {
      var ENTER_KEY_CODE = 13;
      if (event.keyCode === ENTER_KEY_CODE) {
        this.sendMsg();
      }
    },

    markdown: function(source) {
      var REGEXP_URL = /https?:\/\/(\S+)/i;
      var REGEXP_IMAGE = /https?:\/\/(\S+)\.(png|gif|bmp|jpg|jpeg|ico)/i;
      var REPLACEMENTS = [
        [/### (.+)\n?/g, "<h3>$1</h3>\n"],
        [/\*\*(.+)\*\*/g, "<strong>$1</strong>"],
        [/\*(.+)\*/g, "<em>$1</em>"],
        [/!\[(.+)\]\((.+)\)/, '<img src="$2" alt="$1"/>'],
        [/\[(.+)\]\((.+)\)/, '<a href="$2">$1</a>']
      ];
      var placeholders = [];

      for (var count = 0; true; ++count) {
        var image = true;
        var match = source.match(REGEXP_IMAGE);
        if (!match) {
          image = false;
          match = source.match(REGEXP_URL);
        }
        if (match) {
          var text = "%@[%@](%@)".fmt((image ? "!" : ""), match[0], match[0]);
          placeholders.push(text);
          var begin = source.slice(0, match.index);
          var end = source.slice(match.index + match[0].length);
          source = [begin, '$$', count, '$$', end].join('');
        } else { break; }
      }
      _.each(placeholders, function(value, index) {
        source = source.replace(['$$', index, '$$'].join(''), value);
      });
      _.each(REPLACEMENTS, function(replacement) {
        source = source.replace(replacement[0], replacement[1]);
      });
      return source;
    },

    onClickClose: function(event) {
      this.$(event.target).parent().remove();
    },

    handleIncomingMessage: function(message) {
      if (message.sender === this.currentUser().email()) {
        return false;
      }

      var groupId = parseInt(message.groupId, 10);

      if (groupId && !_.contains(this.myGroupIds, groupId)) {
        return false;
      }

      try { this.popover(); } catch(err) {}

      // defer ensures app is in DOM before we add a message
      _.defer(this.addMsgToWindow.bind(this), message);
    },

    addMsgToWindow: function(message) {
      // We get sent two messages, so this makes sure we only display
      // each unique message once:
      if (this.$('li.message[data-uuid=%@]'.fmt(message.uuid)).length > 0) {
        return false;
      }

      var messageHTML = this.renderTemplate('message', {
        uuid: message.uuid,
        text: message.text,
        senderName: message.senderName,
        date: (new Date()).toLocaleString()
      });

      this.$('ul#messages').prepend(messageHTML);
    }

  };

}());
