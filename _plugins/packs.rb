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
  FILE_NAME = %r{\A[A-Za-z0-9._/-]+\z}.freeze
  MOOD_COLORS = %w[top horizon bottom sun hemiSky hemiGround fog background].freeze
  MOOD_NUMBERS = %w[sunI hemiI fogD exposure].freeze
  MOOD_OTHER = %w[sunDir ground stars planet].freeze

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
      check_collisions(packs)
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
      unless FILE_NAME.match?(in_pack) && in_pack.split('/').none? { |part| part.start_with?('.') }
        Packs.fatal("bad file name \"#{in_pack}\" in #{pack[:dir]} (use letters, digits, \".\", \"_\" and \"-\")")
      end
      pack[:files] << in_pack
      source_dir = File.dirname(File.join(pack[:dir], in_pack))
      url = "#{pack[:permalink]}#{in_pack}"
      @site.static_files << PackFile.new(@site, source_dir, File.basename(in_pack), url)
    end

    def check_front_matter(pack)
      data = pack[:page].data
      title = data['title']
      Packs.fatal("#{pack[:dir]}/index.md has no title") if title.nil? || title.to_s.strip.empty?
      check_mood_object(pack)
      REMOVED_KEYS.each do |key|
        Jekyll.logger.warn('packs:', "#{pack[:dir]}/index.md: key \"#{key}\" was removed (ADR-001) and is ignored") if data.key?(key)
      end
    end

    # A mood object is merged over `golden`. A wrong type reaches three.js and stops the whole scene.
    def check_mood_object(pack)
      mood = pack[:page].data['mood']
      return unless mood.is_a?(Hash)

      where = "#{pack[:dir]}/index.md: mood"
      mood.each do |key, value|
        key = key.to_s
        if MOOD_COLORS.include?(key)
          Packs.fatal("#{where}.#{key} must be a color string") unless value.is_a?(String) && !value.strip.empty?
        elsif MOOD_NUMBERS.include?(key)
          Packs.fatal("#{where}.#{key} must be a number") unless value.is_a?(Numeric)
        elsif key == 'sunDir'
          Packs.fatal("#{where}.sunDir must be [x, y, z] with 3 numbers") unless numbers?(value, 3)
        elsif key == 'ground'
          ok = value.is_a?(Array) && value.length == 2 && value.all? { |c| c.is_a?(String) }
          Packs.fatal("#{where}.ground must be 2 color strings") unless ok
        elsif !MOOD_OTHER.include?(key)
          Packs.fatal("#{where}: unknown key #{key.inspect}")
        end
      end
    end

    def numbers?(value, count)
      value.is_a?(Array) && value.length == count && value.all? { |v| v.is_a?(Numeric) }
    end

    # Two pack outputs, or a pack output and a site file, must not share one URL.
    def check_collisions(packs)
      taken = {}
      @site.pages.each { |page| taken[page.url] = page.path }
      @site.static_files.each { |file| taken[file.url] = file.path unless file.is_a?(PackFile) }
      packs.each_value do |pack|
        urls = pack[:files].map { |f| ["#{pack[:permalink]}#{f}", "#{pack[:dir]}/#{f}"] }
        urls << [pack[:permalink], "#{pack[:dir]}/index.md"]
        urls.each do |url, source|
          Packs.fatal("#{source} and #{taken[url]} give the same URL #{url}") if taken.key?(url)
          taken[url] = source
        end
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
