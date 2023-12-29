const {
  aws_ssm, CfnOutput, Stack
} = require('aws-cdk-lib');

const {
  AutomationDocument,
  DocumentFormat,
  Input,
  StringVariable,
  HardCodedString,
  RunCommandStep,
  StepRef,
  OnFailure,
  StringDocument, // for direct import from JSON
  HardCodedStringList,
  HardCodedStringMap,
  HardCodedDesiredState,
  ChangeInstanceStateStep,
  HardCodedNumber
} = require('@cdklabs/cdk-ssm-documents')


/* SUPPORTED IMPORT FROM JSON
// for documents only (not automation documents)
const  { Document } = require('cdk-ssm-document');


// by '@cdklabs/cdk-ssm-documents' (but aws:runCommand and aws:aws:changeInstanceState not implemented)
let content = fs.readFileSync('.json');
const myDoc = StringDocument.fromJson(this, "MyAutomationDocument", content);


// or (documents only)
const  { CommandDocument } =  = require('@cdklabs/cdk-ssm-documents')
*/

class Automation extends Stack {

  generateTasks(target, InstanceId, bucketName, documents) {
    // start
    const startDocument = new AutomationDocument(this, "StartDoc" + target, {
      documentFormat: DocumentFormat.JSON,
      documentName: "Start" + target,
    });

    const startInstanceStep = new ChangeInstanceStateStep(this, "StartInstance" + target, {
      instanceIds: HardCodedStringList.of([InstanceId]),
      desiredState: HardCodedDesiredState.RUNNING,
    });

    const startStep = new RunCommandStep(this, "Start" + target, {
      documentName: HardCodedString.of('AWS-RunShellScript'),
      parameters: HardCodedStringMap.of({
        commands: [
          'cd /home/ubuntu/codebase/' + target,
          './awsStart.sh'
        ],
        workingDirectory: ['/home/ubuntu/codebase/' + target],
        executionTimeout: ['3600']
      }),
      targets: HardCodedStringList.of([InstanceId]),
      commandTimeoutSeconds: HardCodedNumber.of(600)
    })

    startDocument.addStep(startInstanceStep);
    startDocument.addStep(startStep);
    documents.push(startDocument.documentName);

    console.log(`Automation document for start ${target} generated:`);
    console.log(startDocument.print());
    console.log();

    // stop
    const stopDocument = new AutomationDocument(this, "StopDoc" + target, {
      documentFormat: DocumentFormat.JSON,
      documentName: "Stop" + target,
    });

    const stopStep = new RunCommandStep(this, "Stop" + target, {
      documentName: HardCodedString.of('AWS-RunShellScript'),
      parameters: HardCodedStringMap.of({
        commands: [
          'cd /home/ubuntu/codebase/' + target,
          './awsStop.sh'
        ],
        workingDirectory: ['/home/ubuntu/codebase/' + target],
        executionTimeout: ['3600']
      }),
      targets: HardCodedStringList.of([InstanceId]),
      commandTimeoutSeconds: HardCodedNumber.of(600)
    })

    stopDocument.addStep(startInstanceStep);
    stopDocument.addStep(stopStep);
    documents.push(stopDocument.documentName);

    console.log(`Automation document for stop ${target} generated:`);
    console.log(stopDocument.print());
    console.log();

    // backup
    const backupDocument = new AutomationDocument(this, "BackupDoc" + target, {
      documentFormat: DocumentFormat.JSON,
      documentName: "Backup" + target,
    });

    const backupStep = new RunCommandStep(this, "Backup" + target, {
      documentName: HardCodedString.of('AWS-RunShellScript'),
      parameters: HardCodedStringMap.of({
        commands: [
          'cd /home/ubuntu/codebase/' + target,
          './awsBackup.sh ' + bucketName
        ],
        workingDirectory: ['/home/ubuntu/codebase/' + target],
        executionTimeout: ['3600']
      }),
      targets: HardCodedStringList.of([InstanceId]),
      commandTimeoutSeconds: HardCodedNumber.of(600)
    });

    backupDocument.addStep(startInstanceStep);
    backupDocument.addStep(backupStep);
    documents.push(backupDocument.documentName);

    console.log(`Automation document for backup ${target} generated:`);
    console.log(backupDocument.print());
    console.log();

    // clean
    const cleanDocument = new AutomationDocument(this, "CleanDoc" + target, {
      documentFormat: DocumentFormat.JSON,
      documentName: "Clean" + target,
    });

    const cleanStep = new RunCommandStep(this, "Clean" + target, {
      documentName: HardCodedString.of('AWS-RunShellScript'),
      parameters: HardCodedStringMap.of({
        commands: [
          'cd /home/ubuntu/codebase/' + target,
          './awsClean.sh'
        ],
        workingDirectory: ['/home/ubuntu/codebase/' + target],
        executionTimeout: ['3600']
      }),
      targets: HardCodedStringList.of([InstanceId]),
      commandTimeoutSeconds: HardCodedNumber.of(600)
    });

    cleanDocument.addStep(startInstanceStep);
    cleanDocument.addStep(cleanStep);
    documents.push(cleanDocument.documentName);

    console.log(`Automation document for clean ${target} generated:`);
    console.log(cleanDocument.print());
    console.log();

    // restore
    const restoreDocument = new AutomationDocument(this, "RestoreDoc" + target, {
      documentFormat: DocumentFormat.JSON,
      documentName: "Restore" + target,
    });

    const restoreStep = new RunCommandStep(this, "Restore" + target, {
      documentName: HardCodedString.of('AWS-RunShellScript'),
      parameters: HardCodedStringMap.of({
        commands: [
          'cd /home/ubuntu/codebase/' + target,
          './awsRestore.sh ' + bucketName
        ],
        workingDirectory: ['/home/ubuntu/codebase/' + target],
        executionTimeout: ['3600']
      }),
      targets: HardCodedStringList.of([InstanceId]),
      commandTimeoutSeconds: HardCodedNumber.of(600)
    });

    restoreDocument.addStep(startInstanceStep);
    restoreDocument.addStep(restoreStep);
    documents.push(restoreDocument.documentName);

    console.log(`Automation document for restore ${target} generated:`);
    console.log(restoreDocument.print());
    console.log();

    return backupStep;
  }

  constructCMDs(documents) {
    let out = '\n';
    for (let i = 0; i < documents.length; i++) {
      out += `aws ssm start-automation-execution --document-name "${documents[i]}" --document-version '\$DEFAULT' --region us-east-1\n`;
    }
    return out;
  }

  constructor(scope, id, props) {
    super(scope, id, props);

    let documents = [];

    let backupTasks = [];
    for (let i = 0; i < props.targets.length; i++) {
      const backupTask = this.generateTasks(props.targets[i], props.InstanceId, props.backupBucketName, documents);
      backupTasks.push(backupTask);
    }

    const backupAllDocument = new AutomationDocument(this, "BackupAllAndSleep", {
      documentFormat: DocumentFormat.JSON,
      documentName: "BackupAllAndSleep",
      // for input parameters (in combination with StringVariable and following {{PARAMETER}} pattern inside parameters definition below)
      //docInputs: [Input.ofTypeString('MyInput', { defaultValue: 'something' })],
    });

    const stopInstanceStep = new ChangeInstanceStateStep(this, "StopInstance", {
      instanceIds: HardCodedStringList.of([props.InstanceId]),
      desiredState: HardCodedDesiredState.STOPPED
    });

    for (let i = 0; i < backupTasks.length; i++) {
      backupAllDocument.addStep(backupTasks[i]);
    }

    backupAllDocument.addStep(stopInstanceStep);
    documents.push(backupAllDocument.documentName);

    console.log('Automation document for daily hibernation generated:');
    console.log(backupAllDocument.print());
    console.log();

    const cfnMaintenanceWindow = new aws_ssm.CfnMaintenanceWindow(this, 'EveryDayMaintenanceWindow', {
      allowUnassociatedTargets: true,
      cutoff: 0, // hours
      duration: 1, // hours
      name: 'everyDayMaintenanceWindow',
      schedule: 'rate(1 minutes)',
      // the properties below are optional
      description: 'Every day',
      //endDate: 'endDate',
      //scheduleOffset: 123,
      //scheduleTimezone: 'scheduleTimezone',
      //startDate: 'startDate',
    });

    const targetInstance = new aws_ssm.CfnMaintenanceWindowTarget(this, 'TargetInstance', {
      resourceType: 'INSTANCE',
      targets: [{
        key: 'InstanceIds',
        values: [props.InstanceId],
      }],
      windowId: cfnMaintenanceWindow.ref,
    });

    const backupAllAndSleepTask = new aws_ssm.CfnMaintenanceWindowTask(this, 'BackupAllAndSleepTask', {
      priority: 1,
      taskArn: 'BackupAllAndSleep',
      taskType: 'AUTOMATION',
      windowId: cfnMaintenanceWindow.ref,
      maxConcurrency: '1',
      maxErrors: '1',
      name: 'BackupAllAndSleepTask',
      targets: [{
        key: 'InstanceIds',
        values: [props.InstanceId],
      }],
      taskInvocationParameters: {
        maintenanceWindowAutomationParameters: {
          documentVersion: '1',
        },
        /*
        maintenanceWindowRunCommandParameters: {
          timeoutSeconds: 600,
          documentVersion: '1',
          parameters: {
            commands: [
              'cd codebase',
              'docker compose -f docker-compose.yml up -d'
            ],
            workingDirectory: ['/home/ubuntu'],
            executionTimeout: ['3600']
          },
        },
        */
      },
    });

    const cmd = this.constructCMDs(documents);

    new CfnOutput(this, 'automations', {
      value: cmd
    });
  }
}

module.exports = { Automation }
