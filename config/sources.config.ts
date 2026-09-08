export const SOURCES_CONFIG = {
  // Настройки пользователя и стек разработчика
  DEVELOPER_PROFILE: {
    experienceYears: '3+',
    coreStack: [
      'WordPress',
      'WooCommerce',
      'HTML5',
      'CSS3',
      'JavaScript',
      'TypeScript',
      'React',
      'Node.js',
      'GitHub'
    ],
    extendedStack: [
      'Next.js',
      'Tailwind CSS',
      'Elementor',
      'ACF Pro (Advanced Custom Fields)',
      'Gutenberg',
      'Vite',
      'Express',
      'REST API',
      'GraphQL',
      'Figma to HTML/React',
      'Speed Optimization (PageSpeed / Core Web Vitals)',
      'Website bug fixing & maintenance'
    ]
  },

  // Источники RSS и фиды
  UPWORK_FEEDS: [
    {
      name: 'Upwork WordPress',
      url: 'https://www.upwork.com/ab/feed/jobs/rss?q=wordpress&sort=recency'
    },
    {
      name: 'Upwork React & TypeScript',
      url: 'https://www.upwork.com/ab/feed/jobs/rss?q=react+typescript&sort=recency'
    },
    {
      name: 'Upwork Website Fix / Bugfix',
      url: 'https://www.upwork.com/ab/feed/jobs/rss?q=website+fix&sort=recency'
    },
    {
      name: 'Upwork WooCommerce',
      url: 'https://www.upwork.com/ab/feed/jobs/rss?q=woocommerce&sort=recency'
    },
    {
      name: 'Upwork Landing Page',
      url: 'https://www.upwork.com/ab/feed/jobs/rss?q=landing+page&sort=recency'
    },
    {
      name: 'Upwork Node.js Web',
      url: 'https://www.upwork.com/ab/feed/jobs/rss?q=node+web&sort=recency'
    }
  ],

  // Freelancehunt (крупнейшая украинская биржа, без заказов из РФ)
  // Категории: 1 = Веб-программирование, 2 = Сайты под ключ, 24 = Верстка, 99 = Доработка сайтов
  FREELANCEHUNT_FEEDS: [
    {
      name: 'Freelancehunt Web & Сайты под ключ',
      url: 'https://freelancehunt.com/projects.rss?skills[]=1&skills[]=2&skills[]=24&skills[]=99'
    }
  ],

  // Reddit сабреддиты с предложениями работы
  REDDIT_FEEDS: [
    {
      name: 'Reddit r/forhire',
      url: 'https://www.reddit.com/r/forhire/search.rss?q=flair%3Ahiring+(website+OR+wordpress+OR+react+OR+developer)&restrict_sr=on&sort=new'
    },
    {
      name: 'Reddit r/freelance_forhire',
      url: 'https://www.reddit.com/r/freelance_forhire/search.rss?q=hiring+(website+OR+wordpress+OR+react)&restrict_sr=on&sort=new'
    }
  ],

  // Удаленные доски вакансий и контрактов
  REMOTE_BOARDS_FEEDS: [
    {
      name: 'WeWorkRemotely Frontend',
      url: 'https://weworkremotely.com/categories/remote-front-end-programming-jobs.rss'
    },
    {
      name: 'WeWorkRemotely Fullstack',
      url: 'https://weworkremotely.com/categories/remote-full-stack-programming-jobs.rss'
    }
  ]
};
