const {Stack, App, StackProps, CfnOutput} = require('aws-cdk-lib');
const {Peer, Port, SecurityGroup, SubnetType, Vpc} =  require('aws-cdk-lib/aws-ec2');
const { Network } =  require('./vpc');

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
  }
}

module.exports = { PersonalStack }
