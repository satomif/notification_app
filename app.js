(function() {

  return {
    events: {
      'app.activated': 'init',
      'click #send-msg': 'onClickSendMsg',
      'click a.close': 'onClickClose',
      'keypress input.message': 'onMsgKeyUp',
      'notification.notificationMessage': 'handleIncomingMessage'
    },

    requests: {
      'sendMsg': function(msg) {
        var payload = {
          msg: msg,
          sender: this.currentUser().email(),
          senderName: this.currentUser().name()
        };

        return {
          url: '/api/v2/apps/notify',
          type: 'POST',
          data: {
            event: 'notificationMessage',
            body: payload,
            app_id: 0
          }
        };
      }
    },

    init: function() {
      if(this.currentUser().role() === "admin") {
        this.switchTo('admin');
      } else {
        this.switchTo('agent');
      }
    },

    onClickSendMsg: function() {
      this.sendMsg();
    },

    onMsgKeyUp: function(event) {
      if (event.keyCode === 13) {
        this.sendMsg();
      }
    },

    sendMsg: function(){
      var message = this.$('input.message').val();

      this.ajax('sendMsg', message);

      this.$('input.message').val("");
    },

    onClickClose: function(event) {
      this.$(event.target).parent().remove();
    },

    handleIncomingMessage: function(message) {
      console.log(message);

      if (message.sender === this.currentUser().email()) {
        return false;
      }

      var messageHTML = this.renderTemplate('message', {
        uuid: message.uuid,
        msg: message.msg,
        senderName: message.senderName
      });

      this.popover();

      var addMsgToWindow = _.bind(function(){
        if (this.$('li.message[data-uuid=%@]'.fmt(message.uuid)).length > 0) {
          return false;
        }

        this.$('ul#messages').prepend(messageHTML);
      }, this);

      // content isn't generated until after popover, which doesn't give
      // us a callback
      setTimeout(addMsgToWindow, 250);
    }

  };

}());
