const {
  CfnKeyPair
} = require('aws-cdk-lib/aws-ec2');

const {
  Stack
} = require('aws-cdk-lib');

const fs = require('fs');
const os = require("os");
const path = require('path');

class Keys extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    let publicKey = fs.readFileSync(path.join(os.homedir(), process.env.KEY_FILE_NAME + '.pub'));
    publicKey = publicKey.toString().split(' ').slice(0, 2).join(' ');

    console.log("SSH key:");
    console.log(publicKey);
    console.log();

    this.keyPair = new CfnKeyPair(this, 'KeyPair', {
      keyName: 'mainPersonal',
      keyFormat: 'pem',
      keyType: 'rsa',
      // if publicKeyMaterial ommited then new key will be created and it can be obtained this way:
      // aws ssm get-parameter --name /ec2/keypair/key-05abb699beEXAMPLE --with-decryption --query Parameter.Value --output text > new-key-pair.pem
      publicKeyMaterial: publicKey
    });
  }
}

module.exports = { Keys }
