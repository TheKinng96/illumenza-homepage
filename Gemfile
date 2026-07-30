source "https://rubygems.org"

# Requires Ruby 3.x — the system Ruby 2.6 on macOS cannot build the ffi
# native extension this gemset needs. `mise.toml` pins a working version;
# run `mise install` then `bundle install`.

# Pinned to the Jekyll version GitHub Pages' builder uses, so local output
# matches what gets published. Do not upgrade without checking
# https://pages.github.com/versions/
gem "jekyll", "~> 3.10.0"

group :jekyll_plugins do
  gem "jekyll-paginate", "~> 1.1"
end

# Ruby 3.x removed webrick from stdlib; harmless on 2.6.
gem "webrick", "~> 1.8"
