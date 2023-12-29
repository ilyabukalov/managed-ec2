const { Stack } = require('aws-cdk-lib');
const { Network } = require('./vpc');
const { S3 } = require('./s3');
const { Server } = require('./server');
const { Keys } = require('./keys');
const { Automation } = require('./automation');

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

class PersonalStack extends Stack {
  /**
   * @param {cdk.App} scope
   * @param {string} id
   * @param {cdk.StackProps} props
   */
  constructor(scope, id, props) {
    super(scope, id, props);


    // Create VPC and Security Group
    const vpcPersonal = new Network(this, 'Network');

    const s3 = new S3(this, 'S3', {
      codebaseFolders: CODEBASE_FOLDERS.map(x => x.folderName)
    });

    const keys = new Keys(this, 'Keys');

    // Create EC2 Instance
    // We will pass props to ServerResources to create the EC2 instance
    const serverResources = new Server(this, 'EC2', {
      vpc: vpcPersonal.vpc,
      eip: vpcPersonal.eip,
      sshKey: keys.keyPair.keyName,
      sshSecurityGroup: vpcPersonal.sshSecurityGroup,
      httpSecurityGroup: vpcPersonal.httpSecurityGroup,
      az: vpcPersonal.vpc.availabilityZones[0],
      codeStorageBucket: s3.codeStorage,
      backupBucket: s3.backupBucket
    });

    new Automation(this, 'Automation', {
      backupBucketName: s3.backupBucket.bucketName,
      targets: CODEBASE_FOLDERS.map(x => x.serviceName),
      InstanceId: serverResources.instance.instanceId
    });
  }
}

module.exports = { PersonalStack }
