const {
  RemovalPolicy,
} = require('aws-cdk-lib');

const {
  Bucket,
  ObjectOwnership
} = require('aws-cdk-lib/aws-s3');

const {
  Source,
  BucketDeployment
} = require('aws-cdk-lib/aws-s3-deployment');

const { Construct } = require('constructs');

const os = require("os");
const path = require('path');

class CodeStorage extends Construct {
  constructor(scope, id) {
    super(scope, id);

    // Create an Asset Bucket for the Instance.  Assets in this bucket will be downloaded to the EC2 during deployment
    this.assetBucket = new Bucket(this, 'assetBucket', {
      publicReadAccess: false,
      removalPolicy: RemovalPolicy.DESTROY,
      objectOwnership: ObjectOwnership.BUCKET_OWNER_PREFERRED,
      autoDeleteObjects: true,
    });

    console.log("Deploying files from:");
    const codebaseFolder = path.join(os.homedir(), process.env.CODEBASE_FOLDER);
    console.log(codebaseFolder);

    // Deploy the local assets to the Asset Bucket during the CDK deployment
    new BucketDeployment(this, 'assetBucketDeployment', {
      sources: [Source.asset(codebaseFolder)],
      destinationBucket: this.assetBucket,
      retainOnDelete: false,
      exclude: ['**/node_modules/**', '**/dist/**', '.git/*'],
      memoryLimit: 512,
    });
  }
}

module.exports = { CodeStorage }
