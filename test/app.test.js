const cdk = require('aws-cdk-lib');
const { Match, Template } = require('aws-cdk-lib/assertions');
const SampleApp = require('../lib/app-stack');

test('Created', () => {
  const app = new cdk.App();
  // WHEN
  const stack = new SampleApp.AppStack(app, 'MyTestStack');
  // THEN
  const template = Template.fromStack(stack);
  //template.hasResourceProperties('......', {});

  //template.resourceCountIs('AWS::SNS::Topic', 1);
});
