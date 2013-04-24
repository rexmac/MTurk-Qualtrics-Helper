$(function() {

  // Empty input elements appear 1 pixel higher than they should when using Bootstrap 2
  // May be limited to form-horizontal
  //$('input:text').val('0');
  //window.setTimeout(function() { $('input:text').val(''); }, 2050);

  // Select all text in textarea when focused
  $('#qualtricsHeaderCode').focus(function() {
    var $this = $(this);
    $this.select().mouseup(function(e) {
      e.off('mouseup');
      e.preventDefault();
    });
  }).keyup(function(e) {
    if(e.which === 9) {
      this.select();
    }
  });

  $('#reward').change(function() {
    $(this).val(sprintf('%0.2f', parseFloat($(this).val(), 10)));
  });

  $('#country').fcbkcomplete({
    json_url: 'iso.json',
    addontab: true,
    height: 5,
    cache: true,
    //newel: true
    firstselected: true
  });

  $('.controls').find('input, select, textarea').tooltip({
    placement: 'right',
    trigger: 'focus'
  });

  $('#mturkQualtricsHelperForm').validate({
    rules: {
      AccessKeyId: 'required',
      AccessKey: 'required',
      Title: 'required',
      ExternalUrl: {
        required: true,
        url: true
      },
      Description: 'required',
      FrameHeight: {
        required: true,
        number: true
      },
      MaxAssignments: {
        required: true,
        number: true
      },
      'Reward.1.Amount': {
        required: true,
        number: true
      },
      'duration[time]': {
        required: true,
        number: true
      },
      'autoApprovalDelay[time]': {
        required: true,
        number: true
      },
      'lifetime[time]': {
        required: true,
        number: true
      },
      confirmation: 'required'
    },
    messages: {
      confirmation: {
        required: 'Please check the box above'
      }
    },
    errorPlacement: function(error, element) {
      element.parents('.controls').append(error);
    },
    errorElement: 'span',
    errorClass: 'help-inline',
    highlight: function(element, errorClass, validClass) {
      $(element).parents('.control-group').addClass('error');
    },
    unhighlight: function(element, errorClass, validClass) {
      $(element).parents('.control-group').removeClass('error');
    },
    submitHandler: function(form) {
      var d = new Date(),
          service = 'AWSMechanicalTurkRequester',
          operation = 'CreateHIT',
          awsVersion = '2012-03-25',
          timeUnits = [], awsData = {}, awsUrl;

      timeUnits = [
        null,
        60,
        60 * 60,
        60 * 60 * 24,
        60 * 60 * 24 * 7,
        60 * 60 * 24 * 30
      ];

      awsData.Timestamp = sprintf('%4d-%02d-%02dT%02d:%02d:%02d+00:00',
        d.getUTCFullYear(),
        (d.getUTCMonth() + 1),
        d.getUTCDate(),
        d.getUTCHours(),
        d.getUTCMinutes(),
        d.getUTCSeconds()
      );

      awsData.Signature = CryptoJS.HmacSHA1((service + operation + awsData.Timestamp), $('#accessKey').val()).toString(CryptoJS.enc.Base64);

      $.each($(form).serializeArray(), function(i, o) {
        if('Sandbox' === o.name) {
          awsData.Sandbox = 1;
        } else if('country[]' === o.name) {
          awsData.country = $('#country').val();
        } else {
          awsData[o.name] = o.value;
        }
      });

      awsData['AutoApprovalDelayInSeconds'] = awsData['autoApprovalDelay[time]'] * timeUnits[awsData['autoApprovalDelay[units]']];
      awsData['AssignmentDurationInSeconds'] = awsData['duration[time]'] * timeUnits[awsData['duration[units]']];
      awsData['LifetimeInSeconds'] = awsData['lifetime[time]'] * timeUnits[awsData['lifetime[units]']];
      delete awsData['autoApprovalDelay[time]'];
      delete awsData['autoApprovalDelay[units]'];
      delete awsData['duration[time]'];
      delete awsData['duration[units]'];
      delete awsData['lifetime[time]'];
      delete awsData['lifetime[units]'];

      if(awsData['country']) {
        $.each(awsData['country'], function(i, c) {
          awsData['QualificationRequirement.' + ++i + '.QualificationTypeId'] = '00000000000000000071';
          awsData['QualificationRequirement.' +   i + '.Comparator'] = (awsData['countryStatus'] === 'exclude' ? 'Not' : '') + 'EqualTo';
          awsData['QualificationRequirement.' +   i + '.LocaleValue.Country'] = c;
        });
      }
      delete awsData['country'];
      delete awsData['countryStatus'];

      awsData['RequesterAnnotation'] = 'uid';
      awsData['Reward.1.CurrencyCode'] = 'USD';
      if(awsData['Sandbox']) awsData['ExternalUrl'] += '&amp;test=1';

      awsData['Question'] = '<ExternalQuestion xmlns="http://mechanicalturk.amazonaws.com/AWSMechanicalTurkDataSchemas/2006-07-14/ExternalQuestion.xsd">';
      awsData['Question'] += '<ExternalURL>' + awsData['ExternalUrl'] + '</ExternalURL>';
      awsData['Question'] += '<FrameHeight>' + awsData['FrameHeight'] + '</FrameHeight>';
      awsData['Question'] += '</ExternalQuestion>';
      delete awsData['ExternalUrl'];
      delete awsData['FrameHeight'];

      awsUrl = sprintf('https://mechanicalturk.sandbox.amazonaws.com/?Service=%s&Version=%s&Operation=%s',
        service,
        awsVersion,
        operation
      );
      $.each(awsData, function(k, v) {
        awsUrl += '&' + encodeURIComponent(k) + '=' + encodeURIComponent(v);
      });
      awsUrl = awsUrl.replace('ExternalQuestion%20xmlns', 'ExternalQuestion+xmlns');

      $.ajax({
        beforeSend: function() {
          $(document.body).showLoading();
        },
        cache: false,
        complete: function() {
          $(document.body).hideLoading();
        },
        data: {
          awsUrl: awsUrl,
          _render: 'json'
        },
        dataType: 'jsonp',
        jsonp: '_callback',
        success: function(responseData) {
          if(responseData.count > 0) { // success?
            if(responseData.value.items[0].HIT.Request.IsValid === 'True') { // success
              var manageUrl, previewUrl, msg;
              manageUrl = sprintf('https://requester%s.mturk.com/mturk/manageHIT?HITId=%s',
                awsData['Sandbox'] ? 'sandbox' : '',
                responseData.value.items[0].HIT.HITId
              );
              previewUrl = sprintf('https://%s.mturk.com/mturk/preview?groupId=%s',
                awsData['Sandbox'] ? 'workersandbox' : 'www',
                responseData.value.items[0].HIT.HITTypeId
              );
              msg = sprintf('You can <a href="%s" title="Manage HIT (Requester)">manage</a> and <a href="%s" title="Preview HIT as a Worker">preview</a> your HIT on Amazon Mechanical Turk.',
                manageUrl,
                previewUrl
              );
              Notifier.success(msg, 'Success', 'icon');
            } else { // AWS failure
              Notifier.error(
                responseData.value.items[0].HIT.Request.Errors.Error.Message,
                responseData.value.items[0].HIT.Request.Errors.Error.Code,
                'icon'
              );
            }
          } else { // request failure
            Notifier.error('An unknown error occurred. Please try again.', 'Unknown Error', 'icon');
          }
        },
        url: 'http://pipes.yahoo.com/pipes/pipe.run?_id=2837ae31359fe70fd20497bd54e4dd10'
      });

      return false;
    }
  });
});
