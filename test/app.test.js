const { App } = require('aws-cdk-lib');
const { Match, Template } = require('aws-cdk-lib/assertions');
const { AppStack } = require('../lib/app-stack');

test('Created', () => {
  const app = new App();
  // WHEN
  const stack = new AppStack(app, 'MyTestStack', { env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION }});
  // THEN
  const template = Template.fromStack(stack);
  //template.hasResourceProperties('......', {});

  //template.resourceCountIs('AWS::SNS::Topic', 1);

  // for the full of generated CloudFormation JSON match check
  //expect(template.toJSON()).toMatchInlineSnapshot
});
