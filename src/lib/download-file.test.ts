import { beforeEach, describe, expect, it, vi } from 'vitest';

const fileSaverMocks = vi.hoisted(() => ({
  saveAs: vi.fn()
}));

vi.mock('file-saver', () => ({
  saveAs: fileSaverMocks.saveAs
}));

import { downloadFileFromUrl } from './download-file';

describe('downloadFileFromUrl', () => {
  beforeEach(() => {
    fileSaverMocks.saveAs.mockReset();
  });

  it('delegates URL downloads to file-saver with a filename', () => {
    downloadFileFromUrl('https://download.example.com/export.csv', 'export.csv');

    expect(fileSaverMocks.saveAs).toHaveBeenCalledWith(
      'https://download.example.com/export.csv',
      'export.csv'
    );
  });

  it('omits blank filenames', () => {
    downloadFileFromUrl('https://download.example.com/export.csv', '   ');

    expect(fileSaverMocks.saveAs).toHaveBeenCalledWith(
      'https://download.example.com/export.csv',
      undefined
    );
  });
});
