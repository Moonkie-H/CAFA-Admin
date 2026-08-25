/**
 * A complete, valid content set, built fresh for each test that wants one.
 *
 * Every builder returns a new object graph rather than a shared constant, so a
 * test that mutates or projects one cannot reach into another's.
 */
import type { ContentSet, Dictionary, Page } from '../shared/content/types';

export function dictionary(): Dictionary {
  return {
    meta: { title: 'Title', titleTemplate: '%s', description: 'Description' },
    a11y: {
      skipToContent: 'Skip',
      primaryNav: 'Navigation',
      localeSwitch: 'Language',
      worksList: 'Works',
      worksRail: 'Work numbers',
      workPager: 'Work navigation',
      close: 'Close',
    },
    works: { status: { completed: 'Completed', 'in-progress': 'In progress', private: 'Private' } },
    work: {
      index: 'Number',
      status: 'Status',
      year: 'Year',
      discipline: 'Discipline',
      credits: 'Credits',
      previous: 'Previous',
      next: 'Next',
    },
    contact: {
      nav: 'Contact',
      title: 'Contact',
      email: 'Email',
      wechat: 'WeChat',
      address: 'Address',
      hours: 'Hours',
      note: 'Note',
      from: 'From',
      message: 'Message',
      subject: 'Subject',
      send: 'Send',
    },
    notFound: { title: 'Missing', body: 'Not found', home: 'Home' },
    footer: { note: 'Footer' },
    localeName: 'English',
  };
}

export function page(): Page {
  return {
    slug: '',
    title: { zh: '首页', en: 'Home' },
    description: { zh: '描述', en: 'Description' },
    navLabel: { zh: '首页', en: 'Home' },
    sections: [{ kind: 'heading' }],
  };
}

export function content(): ContentSet {
  return {
    site: {
      name: { zh: '工作室', en: 'Studio' },
      contact: {
        email: 'studio@example.com',
        wechat: 'studio',
        address: { zh: '地址', en: 'Address' },
        hours: { zh: '时间', en: 'Hours' },
      },
    },
    pages: [page()],
    works: [],
    programs: [],
    mentors: [],
    zh: dictionary(),
    en: dictionary(),
  };
}
