export const APP_ID = 'data-sync';
export const APP_NAME = 'Data Sync';

export const extCommands = {
    refreshInfoView: `${APP_ID}.refresh-info`,
    refreshCompareView: `${APP_ID}.refresh-compare`,
    refreshMigrateView: `${APP_ID}.refresh-migrate`,

    // Configuration
    showConfiguration: `${APP_ID}.show-config`,
    generateConfiguration: `${APP_ID}.generate-config`,

    // Info activity (pattern -> database -> table)
    processInfo: `${APP_ID}.process-info`,
    analyzeData: `${APP_ID}.analyze-data`,
    importAnalyzeData: `${APP_ID}.import-analyze-data`,

    // Compare activity
    openOriginalFile: `${APP_ID}.open-original-file`,
    openModifiedFile: `${APP_ID}.open-modified-file`,
    inlineDiff: `${APP_ID}.inline-diff`,
    sideBySideDiff: `${APP_ID}.side-by-side-diff`,

    // Migrate activity
    viewMigratePlan: `${APP_ID}.view-migrate-plan`,
    executeMigrate: `${APP_ID}.execute-migrate`
};

export const constants = {
    yes: 'Yes',
    no: 'No',
    more: 'More',
    copy: 'Copy',
    view: 'View',
    viewConfig: 'View Configuration',
    createConfig: 'Create Configuration',
    create: 'Create',
    overwrite: 'Overwrite'
};
