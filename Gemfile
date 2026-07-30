source "https://rubygems.org"

# Requires Ruby 3.x — the system Ruby 2.6 on macOS cannot build the ffi
# native extension this gemset needs. `mise.toml` pins a working version;
# run `mise install` then `bundle install`.

# Pinned to the Jekyll version GitHub Pages' builder uses, so local output
# matches what gets published. Do not upgrade without checking
# https://pages.github.com/versions/
gem "jekyll", "~> 3.10.0"

# GitHub Pages' builder ships this and defaults kramdown to `input: GFM`
# (see _config.yml); without it locally, any post using GFM tables/etc.
# fails to build with "cannot load such file -- kramdown-parser-gfm".
gem "kramdown-parser-gfm", "~> 1.1"

group :jekyll_plugins do
  gem "jekyll-paginate", "~> 1.1"
end

# Ruby 3.x removed webrick from stdlib; jekyll serve needs it.
gem "webrick", "~> 1.8"
