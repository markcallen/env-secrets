import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';
const sidebars: SidebarsConfig = {
  docs: [
    { type: 'doc', id: 'index' },
    { type: 'doc', id: 'overview' },
    { type: 'doc', id: 'installation' },
    {
      type: 'category',
      label: 'Providers',
      items: ['providers/aws-secrets-manager']
    },
    {
      type: 'category',
      label: 'Local Development Tutorials',
      items: [
        'tutorials/local-dev/quickstart',
        'tutorials/local-dev/docker-compose',
        'tutorials/local-dev/nextjs',
        'tutorials/local-dev/node-python-go',
        'tutorials/local-dev/devcontainer-localstack'
      ]
    },
    { type: 'doc', id: 'cli-reference' },
    { type: 'doc', id: 'examples' },
    { type: 'doc', id: 'advanced-usage' },
    { type: 'doc', id: 'best-practices' },
    { type: 'doc', id: 'production-deployment' },
    { type: 'doc', id: 'security' },
    { type: 'doc', id: 'troubleshooting' },
    { type: 'doc', id: 'faq' }
  ]
};
export default sidebars;
