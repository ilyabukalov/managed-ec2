const {
  aws_ssm
} = require('aws-cdk-lib');

const { Construct } = require('constructs');
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

class Automation extends Construct {

  generateTasks(target, InstanceId, bucketName) {
    // start
    const startDocument = new AutomationDocument(this, "StartAutomation" + target, {
      documentFormat: DocumentFormat.JSON,
      documentName: "StartAutomation" + target,
    });

    const startInstanceStep = new ChangeInstanceStateStep(this, "StartInstanceStep" + target, {
      instanceIds: HardCodedStringList.of([InstanceId]),
      desiredState: HardCodedDesiredState.RUNNING,
    });

    const startStep = new RunCommandStep(this, "StartStep" + target, {
      documentName: HardCodedString.of('AWS-RunShellScript'),
      parameters: HardCodedStringMap.of({
        commands: [ // chmod 774 run.sh
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

    console.log(`Automation document for start ${target} generated:`);
    console.log(startDocument.print());

    // stop
    const stopAutomationDocument = new AutomationDocument(this, "StopAutomation" + target, {
      documentFormat: DocumentFormat.JSON,
      documentName: "StopAutomation" + target,
    });

    const stopStep = new RunCommandStep(this, "StopStep" + target, {
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

    stopAutomationDocument.addStep(startInstanceStep);
    stopAutomationDocument.addStep(stopStep);

    console.log(`Automation document for stop ${target} generated:`);
    console.log(stopAutomationDocument.print());

    // backup
    const backupAutomationDocument = new AutomationDocument(this, "BackupAutomation" + target, {
      documentFormat: DocumentFormat.JSON,
      documentName: "BackupAutomation" + target,
    });

    const backupStep = new RunCommandStep(this, "BackupStep" + target, {
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

    backupAutomationDocument.addStep(startInstanceStep);
    backupAutomationDocument.addStep(backupStep);

    // clean
    const cleanAutomationDocument = new AutomationDocument(this, "CleanAutomation" + target, {
      documentFormat: DocumentFormat.JSON,
      documentName: "CleanAutomation" + target,
    });

    const cleanStep = new RunCommandStep(this, "CleanStep" + target, {
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

    cleanAutomationDocument.addStep(startInstanceStep);
    cleanAutomationDocument.addStep(cleanStep);

    // restore
    const restoreAutomationDocument = new AutomationDocument(this, "RestoreAutomation" + target, {
      documentFormat: DocumentFormat.JSON,
      documentName: "RestoreAutomation" + target,
    });

    const restoreStep = new RunCommandStep(this, "RestoreStep" + target, {
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

    restoreAutomationDocument.addStep(startInstanceStep);
    restoreAutomationDocument.addStep(restoreStep);

    return backupStep;
  }

  constructor(scope, id, props) {
    super(scope, id);

    let backupTasks = [];
    for (let i = 0; i < props.targets.length; i++) {
      const backupTask = this.generateTasks(props.targets[i], props.InstanceId, props.backupBucketName);
      backupTasks.push(backupTask);
    }

    const backupAutomationDocument = new AutomationDocument(this, "BackupAutomation", {
      documentFormat: DocumentFormat.JSON,
      documentName: "BackupAutomation",
      // for input parameters (in combination with StringVariable and following {{PARAMETER}} pattern inside parameters definition below)
      //docInputs: [Input.ofTypeString('MyInput', { defaultValue: 'something' })],
    });

    const stopInstanceStep = new ChangeInstanceStateStep(this, "StopInstanceStep", {
      instanceIds: HardCodedStringList.of([props.InstanceId]),
      desiredState: HardCodedDesiredState.STOPPED
    });

    for (let i = 0; i < backupTasks.length; i++) {
      backupAutomationDocument.addStep(backupTasks[i]);
    }

    backupAutomationDocument.addStep(stopInstanceStep);

    console.log('Automation document for daily hibernation generated:');
    console.log(backupAutomationDocument.print())

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

    const shellScriptTask = new aws_ssm.CfnMaintenanceWindowTask(this, 'BackupTask', {
      priority: 1,
      taskArn: 'BackupAutomation',
      taskType: 'AUTOMATION',
      windowId: cfnMaintenanceWindow.ref,
      maxConcurrency: '1',
      maxErrors: '1',
      name: 'shellScriptTask',
      targets: [{
        key: 'InstanceIds',
        values: [props.InstanceId],
      }],
      taskInvocationParameters: {
        maintenanceWindowAutomationParameters: {
          documentVersion: '1',
          parameters: { commands: '1' },
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
  }
}

module.exports = { Automation }
