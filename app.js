(function() {

  return {
    events: {
      'app.activated': 'init',
      'click #send-msg': 'sendMsg',
      'click a.close': 'onMessageCloseClick',
      'keypress input.message': 'onMessageInputKeyPress',
      'notification.notificationMessage': 'handleIncomingMessage',
      'click .toadmin': 'onToadminClick',
      'click .cancel': 'onCancelClick',
      'click .token .delete': 'onTokenDelete',
      'input .add_token input': function(e) { this.formTokenInput(e.target); },
      'focusout .add_token input': function(e) { this.formTokenInput(e.target, true); }
    },

    requests: {
      'sendMsg': function(text, groupIds) {
        return {
          url: '/api/v2/apps/notify.json',
          type: 'POST',
          data: {
            event: 'notificationMessage',
            body: {
              text: text,
              groupIds: groupIds
            },
            app_id: this.id()
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
      var self = this;

      this.notifications = [];
      this.myGroupIds = [];
      this.groups = {};

      this.ajax('getMyGroups').done(function(data) {
        var groupMemberships = data.group_memberships;
        self.myGroupIds = _.map(groupMemberships, function(group) {
          return group.group_id;
        });
      });

      this.ajax('getAssignableGroups').done(function(data) {
        data.groups.forEach(function(group) {
          self.groups[group.name] = group.id;
        });
      });

      this.drawInbox();
    },

    drawInbox: function() {
      var isAdmin = (this.currentUser().role() === "admin");
      this.switchTo('inbox', {
        isAdmin: isAdmin
      });
      this.notifications.forEach(function(notification) {
        this.addMsgToWindow(notification.message, notification.sender);
      }, this)
    },

    onToadminClick: function(event) {
      event.preventDefault();
      this.switchTo('admin');
      this.$('.groups input').autocomplete({
        source: _.keys(this.groups)
      });
    },

    onCancelClick: function(event) {
      event.preventDefault();
      this.drawInbox();
    },

    sendMsg: function() {
      var message = this.$('textarea.message').val();
      var groupIds = _.pick(this.groups, this.tokenValues());
      this.ajax('sendMsg', message, groupIds);
      this.$('textarea.message').val("");
      this.drawInbox();
    },

    tokenValues: function() {
      return this.$('.token_list .token span').map(function(index, token) {
        return token.innerText;
      });
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

    onMessageCloseClick: function(event) {
      event.preventDefault();
      var $notification = this.$(event.target).parent();
      this.notifications = _.reject(this.notifications, function(notification) {
        return notification.message.uuid === $notification.data('uuid');
      });
      $notification.remove();
    },

    handleIncomingMessage: function(message, sender) {
      if (sender.email() === this.currentUser().email()
        || sender.role() !== 'admin') {
        return false;
      }

      var targetGroupIds = _.map(message.groupIds, function(id) { return parseInt(id, 10); });
      if (message.groupIds && !_.intersection(this.myGroupIds, targetGroupIds).length) {
        return false;
      }

      message.uuid = _.uniqueId('msg');

      // Store notification so that we can re-render it later
      this.notifications.push({
        message: message,
        sender: sender,
      });

      try { this.popover(); } catch(err) {}

      // defer ensures app is in DOM before we add a message
      _.defer(this.addMsgToWindow.bind(this), message, sender);
    },

    addMsgToWindow: function(message, sender) {
      this.$('.placeholder').hide();

      // We get sent two messages, so this makes sure we only display
      // each unique message once:
      if (this.$('li.message[data-uuid=%@]'.fmt(message.uuid)).length > 0) {
        return false;
      }

      // escape HTML
      var text = this.$('<div/>').text(message.text).html();
      text = this.markdown(text);

      var messageHTML = this.renderTemplate('message', {
        uuid: message.uuid,
        text: text,
        senderName: sender.name(),
        date: (new Date()).toLocaleString()
      });

      this.$('ul#messages').prepend(messageHTML);
    },

    formTokenInput: function(el, force){
      var input = this.$(el);
      var value = input.val();

      if (force && value.length > 0){
        var li = '<li class="token"><span>'+value+'</span><a class="delete" tabindex="-1">×</a></li>';
        this.$(el).before(li);
        input.val('');
        input.attr('placeholder', '');
      }
    },

    onTokenDelete: function(e) {
      this.$(e.target).parent('li.token').remove();
      if (this.$('.token_list .token').size() === 0) {
        this.$('.token_list input').attr('placeholder', this.I18n.t('groupsPlaceholder'));
      }
    }
  };

}());
