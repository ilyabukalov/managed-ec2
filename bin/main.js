#!/usr/bin/env node
const { App } = require('aws-cdk-lib');
const { Network } = require('../lib/vpc');
const { S3 } = require('../lib/s3');
const { Server } = require('../lib/server');
const { Keys } = require('../lib/keys');
const { Automation } = require('../lib/automation');

const CODEBASE_FOLDERS = [
  {
    serviceName: 'firefly',
    folderName: 'firefly' // folder in ~/
  },
  {
    serviceName: 'zabbix',
    folderName: 'zabbix-server' // folder in ~/
  }
];

const app = new App();

// Create VPC and Security Group
const vpcPersonal = new Network(app, 'PersonalNetwork', {
  /* If you don't specify 'env', this stack will be environment-agnostic.
   * Account/Region-dependent features and context lookups will not work,
   * but a single synthesized template can be deployed anywhere. */

  /* Uncomment the next line to specialize this stack for the AWS Account
   * and Region that are implied by the current CLI configuration. */
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },

  /* Uncomment the next line if you know exactly what Account and Region you
   * want to deploy the stack to. */
  // env: { account: '123456789012', region: 'us-east-1' },

  /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
});

const s3 = new S3(app, 'PersonalS3', {
  codebaseFolders: CODEBASE_FOLDERS,
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },

});

const keys = new Keys(app, 'PersonalKeys', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION }
});

// Create EC2 Instance
// We will pass props to ServerResources to create the EC2 instance
const serverResources = new Server(app, 'PersonalServer', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
  vpc: vpcPersonal.vpc,
  eip: vpcPersonal.eip,
  sshKey: keys.keyPair.keyName,
  sshSecurityGroup: vpcPersonal.sshSecurityGroup,
  httpSecurityGroup: vpcPersonal.httpSecurityGroup,
  az: vpcPersonal.vpc.availabilityZones[0],
  codeStorageBucket: s3.codeStorage,
  backupBucket: s3.backupBucket
});

serverResources.addDependency(keys); // somewhy automatically not recognized, maybe because we use only hardcoded values

new Automation(app, 'PersonalAutomation', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
  backupBucketName: s3.backupBucket.bucketName,
  targets: CODEBASE_FOLDERS.map(x => x.serviceName),
  InstanceId: serverResources.instance.instanceId
});


app.synth();