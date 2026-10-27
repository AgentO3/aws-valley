# frozen_string_literal: true

# Pack structure (stack ADR-001). Each folder under `packs/` that contains `index.md` is one place.
# The folder path is the URL, the containing folder is the parent, and every other file in the
# folder is served under the place URL.
#
# This plugin depends on two Jekyll internals: the `Jekyll::Page#initialize(site, base, dir, name)`
# signature and `Jekyll::StaticFile#destination`. Both are stable in Jekyll 4.x (Gemfile.lock pins 4.4).
# tests/build.spec.js and the fixture builds make a break visible.
module Packs
  NAME = /\A[a-z0-9-]+\z/.freeze
  RESERVED = %w[models textures sounds lib].freeze
  MODULES = %w[exterior.js interior.js rules.js].freeze
  VIEW_SWITCHES = %w[key key-and-button url].freeze
  REMOVED_KEYS = %w[type biome parent].freeze

  def self.fatal(message)
    raise Jekyll::Errors::FatalException, "packs: #{message}"
  end

  # One page for each pack, at the folder path.
  class PackPage < Jekyll::Page
    def initialize(site, dir, permalink)
      super(site, site.source, dir, 'index.md')
      data['layout'] ||= 'place'
      data['permalink'] = permalink
    end
  end

  # A file of a pack, served under the place URL.
  class PackFile < Jekyll::StaticFile
    def initialize(site, dir, name, url)
      super(site, site.source, dir, name)
      @pack_url = url
    end

    def url
      @pack_url
    end

    def destination(dest)
      @site.in_dest_dir(dest, Jekyll::URL.unescape_path(@pack_url))
    end
  end

  # The normal Jekyll reader must skip the pack folder, because Generator makes its pages and files.
  # The folder is not in `exclude` of _config.yml. The file watcher of `jekyll build --watch` and
  # `jekyll serve` reads that list and ignores every path in it, so a pack edit would give no rebuild.
  # The site has its own copy of the config, so the exclusion here does not reach the watcher.
  Jekyll::Hooks.register :site, :after_init do |site|
    folder = (site.config['packs_dir'] || 'packs').to_s.chomp('/')
    site.exclude |= [folder]
  end

  class Generator < Jekyll::Generator
    safe true
    priority :highest

    def generate(site)
      @site = site
      @packs_dir = (site.config['packs_dir'] || 'packs').to_s.chomp('/')
      @root = File.join(site.source, @packs_dir)
      @base = site.config['baseurl'].to_s.chomp('/')
      normalize_view_switch
      Packs.fatal("no index.md in #{@packs_dir}") unless File.file?(File.join(@root, 'index.md'))

      packs = {}
      walk('', packs)
      packs.each_value { |pack| pack[:page] = PackPage.new(site, pack[:dir], pack[:permalink]) }
      packs.each_value { |pack| check_front_matter(pack) }
      packs.each_value do |pack|
        pack[:page].data['place'] = place_hash(pack, packs)
        site.pages << pack[:page]
      end
    end

    private

    def normalize_view_switch
      value = @site.config['view_switch']
      return if VIEW_SWITCHES.include?(value)

      Jekyll.logger.warn('packs:', "unknown view_switch #{value.inspect}, using \"key\"") unless value.nil?
      @site.config['view_switch'] = 'key'
    end

    # rel is the pack path under the packs folder ('' for the root).
    def walk(rel, packs)
      id = rel.empty? ? '/' : rel
      parent = if rel.empty? then nil
               elsif File.dirname(rel) == '.' then '/'
               else File.dirname(rel)
               end
      pack = { id: id, rel: rel, parent: parent, children: [], files: [],
               abs: rel.empty? ? @root : File.join(@root, rel),
               dir: rel.empty? ? @packs_dir : File.join(@packs_dir, rel),
               permalink: rel.empty? ? '/' : "/#{rel}/" }
      packs[id] = pack
      packs[parent][:children] << id if parent
      collect(pack, packs, '')
    end

    # Walks the files of one pack. A subfolder with index.md is a child pack. Any other subfolder
    # is an asset folder of this pack: it gives no page and no door.
    def collect(pack, packs, sub)
      dir_abs = sub.empty? ? pack[:abs] : File.join(pack[:abs], sub)
      Dir.children(dir_abs).sort.each do |name|
        next if name.start_with?('.')

        path = File.join(dir_abs, name)
        in_pack = sub.empty? ? name : File.join(sub, name)
        if File.directory?(path)
          if File.file?(File.join(path, 'index.md'))
            child_rel = pack[:rel].empty? ? in_pack : File.join(pack[:rel], in_pack)
            check_name(name, child_rel)
            # A pack below an asset folder has no parent pack (design D4).
            Packs.fatal("#{child_rel} has no parent pack (#{File.dirname(child_rel)} has no index.md)") unless sub.empty?
            walk(child_rel, packs)
          else
            collect(pack, packs, in_pack)
          end
        elsif in_pack != 'index.md'
          add_file(pack, in_pack)
        end
      end
    end

    def check_name(name, rel)
      return if NAME.match?(name) && !RESERVED.include?(name)

      Packs.fatal("bad pack folder name \"#{name}\" in #{@packs_dir}/#{rel}")
    end

    def add_file(pack, in_pack)
      pack[:files] << in_pack
      source_dir = File.dirname(File.join(pack[:dir], in_pack))
      url = "#{pack[:permalink]}#{in_pack}"
      @site.static_files << PackFile.new(@site, source_dir, File.basename(in_pack), url)
    end

    def check_front_matter(pack)
      data = pack[:page].data
      title = data['title']
      Packs.fatal("#{pack[:dir]}/index.md has no title") if title.nil? || title.to_s.strip.empty?
      REMOVED_KEYS.each do |key|
        Jekyll.logger.warn('packs:', "#{pack[:dir]}/index.md: key \"#{key}\" was removed (ADR-001) and is ignored") if data.key?(key)
      end
    end

    def url_for(pack)
      "#{@base}#{pack[:permalink]}"
    end

    def summary(pack)
      data = pack[:page].data
      { 'id' => pack[:id], 'title' => data['title'], 'url' => url_for(pack), 'base' => url_for(pack),
        'mood' => data['mood'], 'position' => data['position'],
        'files' => MODULES.select { |f| pack[:files].include?(f) } }
    end

    def place_hash(pack, packs)
      data = pack[:page].data
      parent = pack[:parent] && packs[pack[:parent]]
      summary(pack).merge(
        'size' => data['size'].is_a?(Hash) ? data['size'] : {},
        'parent' => parent && { 'id' => parent[:id], 'title' => parent[:page].data['title'],
                                'url' => url_for(parent), 'mood' => parent[:page].data['mood'] },
        'children' => pack[:children].sort.map { |id| summary(packs[id]) }
      )
    end
  end
end
