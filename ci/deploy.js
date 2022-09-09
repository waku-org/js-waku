const { promisify } = require('util')
const { publish } = require('gh-pages')
const ghpublish = promisify(publish)

/* fix for "Unhandled promise rejections" */
process.on('unhandledRejection', err => { throw err })

const Args = process.argv.slice(2)
const USE_HTTPS = Args[0] && Args[0].toUpperCase() === 'HTTPS'

const branch = 'gh-pages'
const org = 'status-im'
const repo = 'js-waku'
/* use SSH auth by default */
let repoUrl = USE_HTTPS
  ? `https://github.com/${org}/${repo}.git`
  : `git@github.com:${org}/${repo}.git`

/* alternative auth using GitHub user and API token */
if (typeof process.env.GH_USER !== "undefined") {
  repoUrl = (
    'https://' + process.env.GH_USER +
    ':' + process.env.GH_TOKEN +
    '@' + `github.com/${org}/${repo}.git`
  )
}

const main = async (url, branch)=> {
  console.log(`Pushing to: ${url}`)
  console.log(`On branch: ${branch}`)
  await ghpublish('build/docs', {
    repo: url,
    branch: branch,
    dotfiles: true,
    silent: false
  })
}

main(repoUrl, branch)
