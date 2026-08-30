/**
 * A complete, valid content set, built fresh for each test that wants one.
 *
 * Every builder returns a new object graph rather than a shared constant, so a
 * test that mutates or projects one cannot reach into another's.
 */
import type { Dictionary, ContentSet, SitePages } from '../shared/content/types';

export function dictionary(): Dictionary {
  return {
    meta: { titleTemplate: '%s' },
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

export function pages(): SitePages {
  const both = (zh: string, en: string) => ({ zh, en });
  return {
    home: {
      title: both('首页', 'Home'),
      description: both('描述', 'Description'),
      statement: both('一句话', 'One line'),
      gallery: [],
    },
    works: { title: both('作品', 'Works'), description: both('描述', 'Description') },
    programs: {
      title: both('课程', 'Programmes'),
      description: both('描述', 'Description'),
      intro: [both('段落', 'Paragraph')],
    },
    about: {
      title: both('关于', 'About'),
      description: both('描述', 'Description'),
      intro: [both('段落', 'Paragraph')],
      mentorsTitle: both('导师', 'Mentors'),
      projectsTitle: both('作品', 'Projects'),
    },
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
    pages: pages(),
    works: [],
    programs: [],
    mentors: [],
    projects: [],
    zh: dictionary(),
    en: dictionary(),
  };
}
