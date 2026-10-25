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
  # A door sits a little inside its ring, and a trigger fires 1.3 m away (TRIGGER_RADIUS in engine.js).
  REACH_SLACK = 2.0
  TRIGGER_GAP = 2.6

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
      packs.each_value { |pack| check_layout(pack, packs) }
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
      check_module_name(pack, in_pack)
      pack[:files] << in_pack
      source_dir = File.dirname(File.join(pack[:dir], in_pack))
      url = "#{pack[:permalink]}#{in_pack}"
      @site.static_files << PackFile.new(@site, source_dir, File.basename(in_pack), url)
    end

    # A file such as Interior.js or interior.mjs is never loaded, so the place would show an empty room
    # with no error. Stop the build and name the file.
    def check_module_name(pack, in_pack)
      return if in_pack.include?('/') || MODULES.include?(in_pack)

      stem = File.basename(in_pack, '.*').downcase
      return unless MODULES.any? { |m| File.basename(m, '.js') == stem } && File.extname(in_pack) =~ /\A\.m?js\z/i

      Packs.fatal("#{pack[:dir]}/#{in_pack} looks like a pack module, but only #{MODULES.join(', ')} are loaded")
    end

    # Same numbers as resolveSize() in engine.js. A door or an exit beyond the walk limit cannot be reached,
    # and two trigger zones that overlap fire the wrong door.
    def check_layout(pack, packs)
      data = pack[:page].data
      size = data['size'].is_a?(Hash) ? data['size'] : {}
      num = ->(key) { size[key].is_a?(Numeric) && size[key].to_f.finite? ? size[key] : nil }
      ring = num.call('ring') || [14, pack[:children].length * 4].max
      limit = num.call('walk_limit') || ring + 12
      where = "#{pack[:dir]}/index.md"

      exit_at = num.call('exit') || 9
      if pack[:parent] && exit_at > limit + REACH_SLACK
        Packs.fatal("#{where}: the exit (#{exit_at} m) is beyond the walk limit (#{limit} m), so the visitor cannot reach it")
      end

      points = []
      pack[:children].each do |id|
        child = packs[id]
        position = child[:page].data['position']
        if position.is_a?(Array) && position.length >= 3 && position.values_at(0, 2).all? { |v| v.is_a?(Numeric) && v.to_f.finite? }
          point = [position[0], position[2]]
          if Math.hypot(*point) > limit + REACH_SLACK
            Packs.fatal("#{child[:dir]}/index.md: position #{position.inspect} is beyond the walk limit of #{where} (#{limit} m), so the visitor cannot reach the door")
          end
          points << [id, point]
        elsif ring > limit + REACH_SLACK
          Packs.fatal("#{where}: the door ring (#{ring} m) is beyond the walk limit (#{limit} m), so the visitor cannot reach the doors")
        end
      end
      points << ['the exit', [0, exit_at]] if pack[:parent]
      points.combination(2) do |(a, pa), (b, pb)|
        next unless Math.hypot(pa[0] - pb[0], pa[1] - pb[1]) < TRIGGER_GAP

        Packs.fatal("#{where}: #{a} and #{b} are less than #{TRIGGER_GAP} m apart, so their door triggers overlap")
      end
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
