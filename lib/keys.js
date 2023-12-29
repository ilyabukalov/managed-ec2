const {
  CfnKeyPair
} = require('aws-cdk-lib/aws-ec2');

const fs = require('fs');
const os = require("os");
const path = require('path');

const { Construct } = require('constructs');

class Keys extends Construct {
  constructor(scope, id) {
    super(scope, id);

    let publicKey = fs.readFileSync(path.join(os.homedir(), process.env.KEY_FILE_NAME + '.pub'));
    publicKey = publicKey.toString().split(' ').slice(0, 2).join(' ');

    console.log("SSH key:");
    console.log(publicKey);

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
