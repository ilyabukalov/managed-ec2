const {Stack, CfnOutput} = require('aws-cdk-lib');
const { Network } =  require('./vpc');
const { CodeStorage } =  require('./codeStorage');
const { Server } =  require('./server');
const { Keys } =  require('./keys');

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

    const codeStorage = new CodeStorage(this, 'CodeStorage');

    const keys = new Keys(this, 'Keys');

    // Create EC2 Instance
    // We will pass props to ServerResources to create the EC2 instance
    const serverResources = new Server(this, 'EC2', {
      vpc: vpcPersonal.vpc,
      eip: vpcPersonal.eip,
      sshKey: keys.keyPair.keyName,
      sshSecurityGroup: vpcPersonal.sshSecurityGroup,
      az:vpcPersonal.vpc.availabilityZones[0],
      codeStorageBucket: codeStorage.assetBucket
    });

    // SSM Command to start a session
    new CfnOutput(this, 'ssmCommand', {
      value: `aws ssm start-session --target ${serverResources.instance.instanceId}`,
    });

    // SSH Command to connect to the EC2 Instance
    new CfnOutput(this, 'sshCommand', {
      value: `ssh ubuntu@${serverResources.instance.instancePublicDnsName}`,
      description: 'The ssh of our instance',
      exportName: 'sshUrl'
    });
  }
}

module.exports = { PersonalStack }
