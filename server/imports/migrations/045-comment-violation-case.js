import { defineMigration } from '/server/imports/utils/defineMigration';
import { dbViolationCaseActionLogs } from '/db/dbViolationCaseActionLogs';

defineMigration({
  version: 45,
  name: 'comment violation case',
  up() {
    dbViolationCaseActionLogs.rawCollection().update(
      { action: 'comment' },
      { $set: { action: 'fscComment' } },
      { multi: true }
    );
  }
});
