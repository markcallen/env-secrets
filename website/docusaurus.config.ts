import { Config } from '@docusaurus/types';
import { themes as prismThemes } from 'prism-react-renderer';

const config: Config = {
  title: 'env-secrets',
  tagline:
    'Fetch secrets from your vault — run any app with env vars injected.',
  url: 'https://markcallen.github.io',
  baseUrl: '/env-secrets/',
  favicon: 'img/favicon.ico',
  organizationName: 'markcallen',
  projectName: 'env-secrets',
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',
  i18n: { defaultLocale: 'en', locales: ['en'] },
  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: require.resolve('./sidebars.ts'),
          routeBasePath: '/',
          editUrl:
            'https://github.com/markcallen/env-secrets/edit/main/website/docs/',
          showLastUpdateAuthor: true,
          showLastUpdateTime: true
        },
        blog: false,
        theme: { customCss: require.resolve('./src/css/custom.css') }
      } as any
    ]
  ],
  themeConfig: {
    image: 'img/social-card.png',
    navbar: {
      title: 'env-secrets',
      logo: { alt: 'env-secrets logo', src: 'img/env-secrets.png' },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docs',
          position: 'left',
          label: 'Docs'
        },
        {
          href: 'https://github.com/markcallen/env-secrets',
          label: 'GitHub',
          position: 'right'
        }
      ]
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            { label: 'Overview', to: '/overview' },
            { label: 'CLI', to: '/cli-reference' }
          ]
        },
        {
          title: 'Community',
          items: [
            {
              label: 'Issues',
              href: 'https://github.com/markcallen/env-secrets/issues'
            }
          ]
        },
        {
          title: 'More',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/markcallen/env-secrets'
            }
          ]
        }
      ],
      copyright: `© ${new Date().getFullYear()} Mark C Allen.`
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula
    }
  }
};
export default config;
