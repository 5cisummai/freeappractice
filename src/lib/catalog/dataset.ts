import dataset from './data/courses.json';

export const AP_DATA = dataset;
export type ApData = typeof AP_DATA;
export type UnifiedCourse = ApData['courses'][number];
export type UnifiedUnit = UnifiedCourse['units'][number];
