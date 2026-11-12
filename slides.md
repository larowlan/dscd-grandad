##

Note:
- We're going to look at developer QOL improvements
- Star ratings are subjective: how much nicer is day-to-day life?

---

## Who am I?
<div class="two-column wider">
<div>
  <img class='avatar' src="/images/avatar2.jpg">
</div>
<div>
<br>
 @larowlan
</div>
</div>

---

## Who are you?

Note:
- Target audience here is module and theme developers

---

## Hooks and procedural code

Note:
- Biggest shift since 8.0: .module and .theme files are both deprecated in D12
- Will be removed in D13
- If you maintain a module and want to support D12 and D11 there are tricks

---

### Object-oriented hooks

★★★★★ <!-- .element: class="rating" -->

<div class="two-column">
<pre class="before" data-since="Drupal 5-11.0"><code class="language-php" data-trim>
// node.module
function node_user_cancel($edit, UserInterface $account, $method) {
  // DO STUFF
}
</code></pre>
<pre class="after fragment fade-in" data-since="Drupal 11.1+"><code class="language-php" data-trim>
namespace Drupal\node\Hook;
use Drupal\Core\Hook\Attribute\Hook;
class NodeHooks {
  public function __construct(
    protected EntityTypeManagerInterface $entityTypeManager,
  ) {}
  #[Hook('user_cancel')]
  public function userCancel(
    array $edit,
    UserInterface $account,
    string $method): void {
    // DO STUFF
  }
}
</code></pre>
</div>

Note:
- Shout out to my colleague Dan Phin (dpi) - his contrib module Hux was the inspiration for this
- Available from: before = all versions; after = Drupal 11.1.0
- Classes in `Drupal\modulename\Hook` are registered as autowired services automatically - constructor injection for free
- Class and method names are arbitrary; one method can carry several #[Hook] attributes
- Backwards compat for 10.1-11.0: register the class as a service in services.yml and keep a procedural shim marked #[LegacyHook] that delegates to it
- From 11.1 the shim is skipped, so one codebase can serve both
- Some hooks stay procedural (install/update); conditionally defined hooks are not supported

---

### Supporting < 11.1

<div class="two-column">
<pre class="before" data-since="Drupal 10.1-11.0"><code class="language-php" data-trim>
// node.module
use Drupal\node\Hook\NodeHooks;
use Drupal\Core\Hook\Attribute\LegacyHook;
#[LegacyHook]
function node_user_cancel($edit, UserInterface $account, $method) {
  \Drupal::service(NodeHooks::class)->userCancel($edit, $account, $method);
}
</code></pre>
<pre class="after" data-since="Drupal 10.1-11.0"><code class="language-php" data-trim>
// node.services.yml
parameters:
  node.skip_procedural_hook_scan: true
services:
  Drupal\node\Hook\NodeHooks:
    autowire: true
</code></pre>
</div>

Note:
- There's a bit going on here, some of it jumps ahead - we'll come back to some things in this services.yml file
- If you still need to support D10 (not long left!) this is how
- You leave the old function but just have it call the service
- You register the hook class (more on autowire later if that's new to you)
- Adding the #[LegacyHook] attribute tells Drupal not to register the function as a hook in D11.1+ (ie prevents duplicates)
- If you have replaced all .module file hooks with objects, you can set this parameter that tells the module handler not to even parse the module file on modern Drupal

---

## A side quest into autowiring

---

### Service aliases

★★★★★ <!-- .element: class="rating" -->

<div class="two-column">
<pre class="before" data-since="Drupal 8-10.0"><code class="language-php" data-trim>
\Drupal::service('entity_type.manager');
</code></pre>
<pre class="after fragment fade-in" data-since="Drupal 10.1+"><code class="language-php" data-trim>
use Drupal\Core\Entity\EntityTypeManagerInterface;
\Drupal::service(EntityTypeManagerInterface::class);
</code></pre>
</div>

Note:
- In the last side you may have noticed \Drupal::service(NodeHooks::class)
- Since 10.1 you don't have to remember magic strings
- You can instead use class constants (from interfaces) to fetch services from the container
- You also get chaining in ide on \Drupal::service and $this->container

---

### Auto-wiring

★★★★★ <!-- .element: class="rating" -->

<div class="two-column">
<pre class="before" data-since="Drupal 8-10.0"><code class="language-yaml" data-trim>
// mymodule.services.yml
services:
  mymodule.some.service:
    class: Drupal\mymodule\Some\Service
    arguments:
     - @entity_type.manager
     - @cache.default # 👈️ more on this later
</code></pre>
<pre class="after fragment fade-in" data-since="Drupal 10.1+"><code class="language-yaml" data-trim>
// mymodule.services.yml
services:
  _defaults:
    autowire: true
  Drupal\mymodule\Some\Service: ~
  # if you need BC use an alias
  # mymodule.some.service: '@Drupal\mymodule\Some\Service'
</code></pre>
</div>

Note:
- You probably don't need to specify the arguments
- You can put autowire: true in _defaults for all classes
- The ~ is null here
- If you need BC for the old strings you can use an alias
- You can do this on a per service basis if you're not ready to do it all at once

---

### Auto-wiring cont.

★★★★★ <!-- .element: class="rating" -->

<div class="two-column">
<pre class="before" data-since="Drupal 8-10.0"><code class="language-php" data-trim>
// mymodule.services.yml
services:
  mymodule.some.service:
    class: Drupal\mymodule\Some\Service
    arguments:
     - @entity_type.manager
     - @cache.default # 👈️ Remember this
// mymodule/src/Some/Service.php
namespace Drupal\mymodule\Some;
use Drupal\Core\Entity\EntityTypeManagerInterface;
use Drupal\Core\Cache\CacheBackendInterface;
final class Service {
  public function __construct(
    protected readonly EntityTypeManagerInterface $entityTypeManager,
    // 👇️️Tricky
    protected readonly CacheBackendInterface $cache,
)
</code></pre>
<pre class="after fragment fade-in" data-since="Drupal 10.1+"><code class="language-php" data-trim>
// mymodule.services.yml
services:
  _defaults:
    autowire: true
  Drupal\mymodule\Some\Class: ~
// mymodule/src/Some/Service.php
namespace Drupal\mymodule\Some;
use Drupal\Core\Entity\EntityTypeManagerInterface;
use Drupal\Core\Cache\CacheBackendInterface;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
final class Service {
  public function __construct(
    protected readonly EntityTypeManagerInterface $entityTypeManager,
    // 😎 Nice
    #[Autowire(service: 'cache.default')
    protected readonly CacheBackendInterface $cache,
)
</code></pre>
</div>

Note:
- Sometimes you will need to specify the arguments
- There's a lot of CacheBackendInterface services in core.services.yml
- Which one did you mean?
- Use the AutoWire attribute and nominate it _with your code_ not in a random services file

---

### Auto-configuring

★★★★★ <!-- .element: class="rating" -->

<div class="two-column">
<pre class="before" data-since="Drupal 8-10.0"><code class="language-yaml" data-trim>
// mymodule.services.yml
services:
  mymodule.some.listener:
    class: Drupal\mymodule\EventSubscribers\Listener
    arguments: [...]
    tags:
      - { name: event_subscriber }
</code></pre>
<pre class="after fragment fade-in" data-since="Drupal 10.1+"><code class="language-yaml" data-trim>
// mymodule.services.yml
services:
  _defaults:
    autoconfigure: true
    autowire: true
  Drupal\mymodule\EventSubscribers\Listener: ~
</code></pre>
</div>

Note:
- No longer need to specify the tags _for certain cases_
- Unlike autowire you cannot _yet_ do this on a per service basis if you're not ready to do it all at once
- There is an issue for that - it will move us closer to Symfony's yaml loader
- Which will mean we can nominate a folder for our services like you can in symfony and not bother with an entry per service 💪
- If you need BC for the old strings you can use an alias like before
- You can autoconfigure:
  - event_subscriber
  - logger_aware
  - queue_factory
  - cache_prewarmable
  - module_install.uninstall_validator
- More coming

---

### Autowired plugins

★★★★☆ <!-- .element: class="rating" -->

<div class="two-column">
<pre class="before" data-since="Drupal 8-11.2"><code class="language-php" data-trim>
class MyBlock extends BlockBase implements ContainerFactoryPluginInterface {
  public function __construct(
    array $configuration,
    $plugin_id, $plugin_definition,
    protected Connection $database,
    protected CacheBackendInterface $cache,
    ) {
    parent::__construct($configuration, $plugin_id,
     $plugin_definition);
  }
  public static function create(ContainerInterface $container, array $configuration, $plugin_id, $plugin_definition) {
    return new static(
      $configuration, $plugin_id,
      $plugin_definition, $container->get('database'),
      $container->get('cache.default')
    );
  }
}
</code></pre>
<pre class="after fragment fade-in" data-since="Drupal 11.3+"><code class="language-php" data-trim>
class MyBlock extends BlockBase {
  public function __construct(
    array $configuration,
    $plugin_id,
    $plugin_definition,
    protected Connection $database,
    #[Autowire(service: 'cache.default')
    protected CacheBackendInterface $cache,
  ) {
    parent::__construct(
      $configuration,
      $plugin_id,
      $plugin_definition,
    );
  }
}
</code></pre>
</div>

Note:
- Ignore the weird line breaks here, added them to get this to fit on the slide
- Available from: after = Drupal 11.3.0
- Uses AutowiredInstanceTrait::createInstanceAutowired() under the hood
- Same #[AutoWire] if you need it

---

### Autowired controllers

★★★★★ <!-- .element: class="rating" -->

<div class="two-column">
<pre class="before" data-since="Drupal 8-10.1"><code class="language-php" data-trim>
class MyController extends ControllerBase {
  public function __construct(
      protected Connection $database,
      protected CacheBackendInterface $cache,
  ) {}
  public static function create(
    ContainerInterface $container
  ) {
    return new static(
      $container->get('database'),
      $container->get('cache.default'),
    );
  }
}
</code></pre>
<pre class="after fragment fade-in" data-since="Drupal 10.2+"><code class="language-php" data-trim>
class MyController extends ControllerBase {
  public function __construct(
    protected Connection $database,
    #[Autowire(service: 'cache.default')]
    protected CacheBackendInterface $cache,
  ) {}
}
</code></pre>
</div>

Note:
- Available from: after = Drupal 10.2.0
- There is an active issue to also support autowiring in methods like Symfony - so you get the services as arguments instead of class properties

---

## .. back to hooks

---

### Hook ordering

★★★★☆ <!-- .element: class="rating" -->

<div class="two-column">
<pre class="before" data-since="Drupal 7+"><code class="language-php" data-trim>
function mymodule_module_implements_alter(&amp;$implementations, $hook) {
  if ($hook === 'entity_type_alter') {
    $group = $implementations['mymodule'];
    unset($implementations['mymodule']);
    $implementations['mymodule'] = $group;
  }
}
</code></pre>
<pre class="after fragment fade-in" data-since="Drupal 11.2+"><code class="language-php" data-trim>
use Drupal\Core\Hook\Order\Order;

#[Hook('entity_type_alter', order: Order::Last)]
public function entityTypeAlter(array &amp;$entity_types): void {
  // ...
}
</code></pre>
</div>

Note:
- Alright so lets go back to OO hooks
- Available from: after = Drupal 11.2.0
- Issue #3485896; CR https://www.drupal.org/node/3493962 "Hook implementations can be ordered with an order parameter"
- Order::First / Order::Last, plus OrderBefore / OrderAfter for relative ordering against another module or class+method
- hook_module_implements_alter now needs #[LegacyModuleImplementsAlter] (CR 3496788)
- Core example: content_translation ContentTranslationHooks uses order: Order::Last

---

### Alter other modules' hooks

★★★☆☆ <!-- .element: class="rating" -->

<div class="two-column">
<pre class="before" data-since="Drupal 7+"><code class="language-php" data-trim>
function mymodule_module_implements_alter(&amp;$implementations, $hook) {
  if ($hook === 'help') {
    unset($implementations['layout_builder']);
  }
}
</code></pre>
<pre class="after fragment fade-in" data-since="Drupal 11.2+"><code class="language-php" data-trim>
use Drupal\Core\Hook\Attribute\RemoveHook;
use Drupal\layout_builder\Hook\LayoutBuilderHooks;

#[RemoveHook(
  'help',
  class: LayoutBuilderHooks::class,
  method: 'help',
)]
</code></pre>
</div>

Note:
- Available from: after = Drupal 11.2.0
- CRs: #[RemoveHook] https://www.drupal.org/node/3496786, #[ReOrderHook] https://www.drupal.org/node/3497308
- Real example in core: navigation module NavigationHooks removes the layout_builder help implementation
- Bug fix worth knowing: #3536470, #[ReOrderHook] targeting a hook with no implementations used to throw a TypeError (11.4)

---

### Preprocess

★★★★☆ <!-- .element: class="rating" -->

<div class="two-column">
<pre class="before" data-since="Drupal 7+"><code class="language-php" data-trim>
// mymodule.module
function mymodule_preprocess_block(array &amp;$variables): void {
  $variables['attributes']['class'][] = 'my-block';
}
</code></pre>
<pre class="after fragment fade-in" data-since="Drupal 11.2+"><code class="language-php" data-trim>
#[Hook('preprocess_block')]
public function preprocessBlock(array &amp;$variables): void {
  $variables['attributes']['class'][] = 'my-block';
}
</code></pre>
</div>

Note:
- Available from: after = Drupal 11.2.0
- Issue #3495943; CR https://www.drupal.org/node/3496491 "Preprocess functions in modules now support object-oriented implementations"
- This is what finally lets a module drop its .module file entirely
- Related: template_preprocess_HOOK functions are now callbacks defined in the theme hook (CR 3504125) - initial preprocess

---

## .. not the Drupal you recognize?

---

### Procedural .module code is going away

★★★★☆ <!-- .element: class="rating" -->

<div class="two-column">
<div>
<pre class="before" data-since="Drupal 8-11"><code class="language-php" data-trim>
// mymodule.module
function mymodule_do_thing(NodeInterface $node) {
  // helper function loaded via .module
}
function mymodule_node_presave($node) {
  mymodule_do_thing($node);
}
</code></pre>
</div>
<div>
<pre class="after fragment fade-in" data-since="Drupal 11.1+"><code class="language-php" data-trim>
class MymoduleHooks {
  #[Hook('node_presave')]
  public function nodePresave(NodeInterface $node): void {
    $this-&gt;doThing($node);
  }
  protected function doThing(NodeInterface $node): void {
    // moved onto the hook class / a service
  }
}
</code></pre>
</div>
</div>

Note:
- Available from: after = Drupal 11.1.0 (hook classes); core conversion of procedural helpers ran through 11.2-12.0
- Core is deprecating module-level functions module by module
- And .inc etc files going away too
- Part of the include-file modernisation initiative #3097045

---

### Goodbye .theme files

★★★☆☆ <!-- .element: class="rating" -->

<div class="two-column">
<div>
<pre class="before" data-since="Drupal 8-11.4"><code class="language-php" data-trim>
// mytheme.theme
function mytheme_preprocess_node(array &amp;$variables): void {
  // ...
}
function mytheme_form_system_theme_settings_alter(&amp;$form, $form_state) {
  // ...
}
</code></pre>
</div>
<div>
<pre class="after fragment fade-in" data-since="Drupal 11.3+ (deprecation: 11.5 / 12.0)"><code class="language-php" data-trim>
namespace Drupal\mytheme\Hook;
class MythemeHooks {
  #[Hook('preprocess_node')]
  public function preprocessNode(array &amp;$variables): void {
    // ...
  }
  #[Hook('form_system_theme_settings_alter')]
  public function themeSettingsAlter(array &amp;$form, FormStateInterface $form_state): void {
    // ...
  }
}
</code></pre>
</div>
</div>

Note:
- Available from: OOP hooks in themes = Drupal 11.3.0; .theme deprecated in 11.5.0 and 12.0.0, autoloading removed in 13
- "Magic autoloading of .theme files can be the source of some very hard to find bugs"
- Need to keep the .theme for older Drupal? Mark the functions with #[ExtensionFileIsConverted] to silence the deprecation (the attribute class is Drupal\Core\Hook\Attribute\ExtensionFileIsConverted).
- A rector rule and DDEV script exist for conversion
- Added bonus of this is src folder in themes is now autoloaded - not just when its the active theme - so you can reliably put OO code in there

---

## Routing & forms

Note:
- Fewer YAML files, co-located code

---

### Routes via attributes

★★★★★ <!-- .element: class="rating" -->

<div class="two-column">
<pre class="before" data-since="Drupal 8+"><code class="language-yaml" data-trim>
# mymodule.routing.yml
system.401:
  path: '/system/401'
  defaults:
    _controller: '\Drupal\system\Controller\Http4xxController::on401'
    _title: 'Unauthorized'
  requirements:
    _access: 'TRUE'
</code></pre>
<pre class="after fragment fade-in" data-since="Drupal 11.4+/12.0*"><code class="language-php" data-trim>
// src/Controller/Http4xxController.php
use Drupal\Core\Routing\Attribute\Route;
#[Route(
  path: '/system/401',
  name: 'system.401',
  title: new TranslatableMarkup('Unauthorized'), // * 12.0
  // _defaults: ['title' => ...] // * 11.4
  requirements: ['_access' =&gt; 'TRUE'],
)]
public function on401() {
  return ['#markup' =&gt; $this-&gt;t('Log in to access this page.')];
}
</code></pre>
</div>

Note:
- Available from: after = Drupal 11.4.0
- Controller must live in the module's Controller namespace to be discovered; route names are required on method-level attributes
- Class-level #[Route] sets defaults for all methods; invokable controllers work with a class-only attribute
- Translatable strings need an explicit TranslatableMarkup
- note:tt
- Core is converting its own routing.yml files module by module (system, user, block, views ...)

---

### Form routes via attributes

★★★★☆ <!-- .element: class="rating" -->

<div class="two-column">
<pre class="before" data-since="Drupal 8+"><code class="language-yaml" data-trim>
user.role.settings:
  path: '/admin/people/role-settings'
  defaults:
    _form: '\Drupal\user\Form\RoleSettingsForm'
    _title: 'Role settings'
  requirements:
    _permission: 'administer permissions'
</code></pre>
<pre class="after fragment fade-in" data-since="Drupal 12.0"><code class="language-php" data-trim>
#[Route(
  path: '/admin/people/role-settings',
  name: 'user.role.settings',
  requirements: ['_permission' =&gt; 'administer permissions'],
  title: new TranslatableMarkup('Role settings'),
)]
class RoleSettingsForm extends FormBase {
  // ...
}
</code></pre>
</div>

Note:
- Available from: after = committed 2026-07-01 to main (12.0.0-alpha1) and 11.x; exact 11.x release to be confirmed
- Same #[Route] attribute; a class implementing FormInterface automatically gets _form set
- Attribute goes on the class only (method-level attributes ignored on forms); multiple #[Route] attributes allowed
- Controller discovery issue to be aware of: #3600697 array handling for JSON:API contrib

---

### Batch callbacks as services

★★★☆☆ <!-- .element: class="rating" -->

<div class="two-column">
<div><pre class="before" data-since="Drupal 8-11.2"><code class="language-php" data-trim>
// mymodule.module (or file: key pointing to an .inc)
function mymodule_process_item($item, array &amp;$context) {
  // ...
}
$batch = (new BatchBuilder ())
  -&gt;addOperation ('mymodule_process_item', [$item])
  -&gt;setFile ($path_to_inc);
</code></pre></div>
<div><pre class="after fragment fade-in" data-since="Drupal 11.3+"><code class="language-php" data-trim>
$batch = (new BatchBuilder ())
  -&gt;addOperation ('mymodule.batch:processItem', [$item])
  -&gt;setFinishCallback ([MyBatch::class, 'finished']);
class MyBatch {
  public function processItem ($item, array &amp;$context) {
  // ...
  }
}
</code></pre></div>
</div>

Note:
- Available from: after = Drupal 11.3.0
- "Batch api callbacks now support callables supported by the CallableResolver"
- service_id:method and Class::method forms; no more need for functions in .module/.inc files; failures now throw instead of being swallowed
- Form callbacks got the same treatment: #3536726 (11.3), #[value_callback] #3616645
- Core's own locale batch callbacks converted: #3581303

---

## Plugins and entities

Note:
- Annotations (Doctrine) are on the way out, attributes are native PHP

---

### Plugins via attributes

★★★★★ <!-- .element: class="rating" -->

<div class="two-column">
<pre class="before" data-since="Drupal 8-11"><code class="language-php" data-trim>
/**
 * Provides a block to display 'Site branding' elements.
 *
 * @Block(
 *   id = "system_branding_block",
 *   admin_label = @Translation("Site branding"),
 * )
 */
class SystemBrandingBlock extends BlockBase {
</code></pre>
<pre class="after fragment fade-in" data-since="Drupal 10.2+"><code class="language-php" data-trim>
use Drupal\Core\Block\Attribute\Block;
/**
 * Provides a block to display 'Site branding' elements.
 */
#[Block(
  id: "system_branding_block",
  admin_label: new TranslatableMarkup("Site branding"),
)]
class SystemBrandingBlock extends BlockBase {
</code></pre>
</div>

Note:
- Available from: after = Drupal 10.2.0; all core plugin types support attributes from 11.2
- CR https://www.drupal.org/node/3395575 "Plugin implementations should use PHP attributes instead of annotations"
- Annotation-only plugin types deprecated for removal in 12.0, annotation plugin implementations in 13.0 (#3265945)
- Syntax tips: `:` instead of `=`, `new` for objects, @Translation becomes new TranslatableMarkup()
- Plugin managers must support attribute discovery from now on (#3577900, main)
- Hundreds of "Convert X plugin discovery to attributes" issues, mostly 2024: field types, formatters, migrate, views, layouts, CKEditor5 ...

---

### Entity types via attributes

★★★☆☆ <!-- .element: class="rating" -->

<div class="two-column">
<pre class="before" data-since="Drupal 8-11.1"><code class="language-php" data-trim>
/**
 * @ContentEntityType(
 *   id = "node",
 *   label = @Translation("Content"),
 *   entity_keys = {
 *     "id" = "nid",
 *     "revision" = "vid",
 *   },
 * )
 */
class Node extends EditorialContentEntityBase {
</code></pre>
<pre class="after fragment fade-in" data-since="Drupal 11.2+"><code class="language-php" data-trim>
#[ContentEntityType(
  id: 'node',
  label: new TranslatableMarkup('Content'),
  entity_keys: [
    'id' =&gt; 'nid',
    'revision' =&gt; 'vid',
  ],
)]
class Node extends EditorialContentEntityBase {
</code></pre>
</div>

Note:
- Available from: after = Drupal 11.2.0
- Plugin definition is unchanged once discovered - purely an authoring improvement
- IDE autocomplete and static analysis now work on entity type definitions

---

### Bundle classes via attributes

★★★★☆ <!-- .element: class="rating" -->

<div class="two-column">
<pre class="before" data-since="Drupal 9.3-11.3"><code class="language-php" data-trim>
function mymodule_entity_bundle_info_alter(array &amp;$bundles): void {
  $bundles['node']['article']['class'] = Article::class;
}
class Article extends Node {}
</code></pre>
<pre class="after fragment fade-in" data-since="Drupal 11.4+"><code class="language-php" data-trim>
use Drupal\Core\Entity\Attribute\Bundle;
#[Bundle(
  entityType: 'node',
  bundle: 'article',
  label: new TranslatableMarkup('Article'),
)]
class Article extends Node {}
</code></pre>
</div>

Note:
- Available from: after = Drupal 11.4.0 (hook-based bundle classes since 9.3) if you don't know what these are - worth your time to investigate - per node type/vocabulary entity classes - not just Node or Term, put your own logic in them
- Treated as derivatives of the entity type plugin, so existing discovery is reused
- Only for entity types that have a bundle entity type; code-only bundles are silently ignored
- Last discovered wins; use hook_entity_bundle_info_alter() to override

---

## Data and config

Note:
- Value objects instead of nested arrays

---

### Schema definitions

★★★☆☆ <!-- .element: class="rating" -->

<div class="two-column">
<pre class="before" data-since="Drupal 7-11.4"><code class="language-php" data-trim>
function comment_schema(): array {
  $schema['comment_entity_statistics'] = [
    'fields' =&gt; [
      'entity_type' =&gt; [
        'type' =&gt; 'varchar_ascii',
        'not null' =&gt; TRUE,
        'default' =&gt; 'node',
        'length' =&gt; EntityTypeInterface::ID_MAX_LENGTH,
      ],
    ],
  ];
  return $schema;
}
</code></pre>
<pre class="after fragment fade-in" data-since="Drupal 11.5+ / 12.0"><code class="language-php" data-trim>
function comment_schema(): Schema {
  $tables[] = new Table(
    name: 'comment_entity_statistics',
    columns: [
      Column::varcharAscii(
        name: 'entity_type',
        length: EntityTypeInterface::ID_MAX_LENGTH,
        notNull: TRUE,
        default: new StringValue('node'),
      ),
    ],
  );
  return new Schema(
    SchemaDefinitionType::Module,
   'comment',
   $tables
  );
}
</code></pre>
</div>

Note:
- Available from: after = Drupal 11.5.0 and 12.0.0
- Immutable value objects in Drupal\Core\Database\SchemaDefinition: Schema, Table, Column, ColumnType, PrimaryKey, Index, ForeignKey ...
- Array form still converted transparently - migrate gradually
- Core modules being converted
- Longer term: driver-specific features such as GIN/GIST indexes

---

### Config forms: #config_target

★★★★★ <!-- .element: class="rating" -->

<div class="two-column">
<div><pre class="before" data-since="Drupal 8-10.1"><code class="language-php" data-trim>
class SearchModeConfigForm extends ConfigFormBase {
  protected function getEditableConfigNames() {
    return ['mymodule.settings'];
  }
  public function buildForm(array $form, FormStateInterface $form_state) {
    $config = $this-&gt;config('mymodule.settings');
    $form['decay_enabled'] = [
      '#type' =&gt; 'checkbox',
      '#title' =&gt; $this-&gt;t('Enable decay scoring'),
      '#default_value' =&gt; $config-&gt;get('decay_enabled'),
    ];
    return parent::buildForm($form, $form_state);
  }
  public function submitForm(array &amp;$form, FormStateInterface $form_state) {
    $this-&gt;config('mymodule.settings')
      -&gt;set('decay_enabled', $form_state-&gt;getValue('decay_enabled'))
      -&gt;save();
    parent::submitForm($form, $form_state);
  }
}
</code></pre></div>
<div><pre class="after fragment fade-in" data-since="Drupal 10.2+"><code class="language-php" data-trim>
class SearchModeConfigForm extends ConfigFormBase {
  use RedundantEditableConfigNamesTrait;
  public function buildForm(array $form, FormStateInterface $form_state) {
    $form['decay_enabled'] = [
      '#type' =&gt; 'checkbox',
      '#title' =&gt; $this-&gt;t('Enable decay scoring'),
      '#config_target' =&gt; 'mymodule.settings:decay_enabled',
    ];
    return parent::buildForm($form, $form_state);
  }
}
</code></pre></div>
</div>

Note:
- Available from: Drupal 10.2.0 (committed to 11.x and backported to 10.2.x on 2023-11-02)
- Issue #3382510 "Introduce a new #config_target Form API property to make it super simple to use validation constraints on simple config forms"; change record https://www.drupal.org/node/3373502
- Format is `config_name:property.path`. The element's default value is loaded from config and the submitted value is saved back to the same property, so no `#default_value` and no `submitForm()` for simple fields
- Real core conversion: CronForm (#3566768) deleted its hand-rolled constructor, `#default_value` and submit handler
- Example form is from the contrib module mymodule (SearchModeConfigForm); the "before" is the pre-10.2 equivalent written out by hand, so say so if asked

---

### No more getEditableConfigNames()

★★★☆☆ <!-- .element: class="rating" -->

<div class="two-column">
<div><pre class="before" data-since="Drupal 8-10.1"><code class="language-php" data-trim>
class SynonymsSettingsForm extends ConfigFormBase {
  protected function getEditableConfigNames() {
    return ['mymodule.settings'];
  }
}
</code></pre></div>
<div><pre class="after fragment fade-in" data-since="Drupal 10.2+"><code class="language-php" data-trim>
use Drupal\Core\Form\RedundantEditableConfigNamesTrait;
class SynonymsSettingsForm extends ConfigFormBase {
use RedundantEditableConfigNamesTrait;
}
</code></pre></div>
</div>

Note:
- Once you're using #config_target everywhere the getEditableConfigNames method is pointless
- Only valid when all the form's config comes through `#config_target` - anything else you save by hand still needs listing

---

### Validation from config schema

★★★★★ <!-- .element: class="rating" -->

<div class="two-column">
<div><pre class="before" data-since="Drupal 8-10.1"><code class="language-php" data-trim>
public function validateForm(array &amp;$form, FormStateInterface $form_state) {
  $weight = $form_state-&gt;getValue('semantic_weight');
  if ($weight &lt; 0 || $weight &gt; 1) {
    $form_state-&gt;setErrorByName('semantic_weight', $this-&gt;t('Weight must be between 0 and 1.'));
  }
  if (!in_array($form_state-&gt;getValue('search_mode'), ['keyword', 'hybrid'])) {
    $form_state-&gt;setErrorByName('search_mode', $this-&gt;t('Invalid mode.'));
  }
  parent::validateForm($form, $form_state);
}
</code></pre></div>
<div><pre class="after fragment fade-in" data-since="Drupal 10.2+"><code class="language-yaml" data-trim>
# config/schema/mymodule.schema.yml
mymodule.settings:
  type: config_object
  constraints:
    FullyValidatable: ~
  mapping:
    search_mode:
      type: string
      constraints:
        NotBlank: ~
        AllowedValues:
          choices: ['keyword', 'hybrid']
    semantic_weight:
      type: float
      constraints:
        Range: { min: 0, max: 1 }
</code></pre></div>
</div>

Note:
- Available from: Drupal 10.2.0 for `#config_target` mapping constraint violations back onto form elements; config schema validation constraints themselves arrived earlier (10.x validatable config work)
- Violations of the property's schema constraints are shown against the matching form element, so there is no `validateForm()` to write
- The same rules then apply everywhere that config is written: config import, recipes, Drush, the API - not just this form
- `FullyValidatable` opts the whole config object in; core's ConfigSchemaChecker (dev services) can flag config that is not fully validatable
- Custom constraints work too

---

### Transforming values: ConfigTarget

★★★☆☆ <!-- .element: class="rating" -->

<div class="two-column">
<div><pre class="before" data-since="Drupal 8-10.1"><code class="language-php" data-trim>
// build: turn the list into lines
'#default_value' =&gt; implode(
  "\n",
  $config-&gt;get('synonyms') ?? []
),
// submit: turn the lines back into a list
$synonyms = array_values(
  array_filter(
    array_map(
      'trim',
      explode("\n", $form_state-&gt;getValue('synonyms'))),
));
$config-&gt;set('synonyms', $synonyms)-&gt;save();
</code></pre></div>
<div><pre class="after fragment fade-in" data-since="Drupal 10.2+"><code class="language-php" data-trim>
'#config_target' =&gt; new ConfigTarget (
  'mymodule.settings',
  'synonyms',
  fromConfig: fn (?array $v) =&gt; implode("\n", $v ?? []),
  toConfig: fn (string $v) =&gt; array_values(
      array_filter(array_map('trim', explode("\n", $v)),
  )),
),
</code></pre></div>
</div>

Note:
- Available from: Drupal 10.2.0 (ConfigTarget arrived with #3382510)

---

# Test improvements

---

### Kernel tests with their own routes

★★★☆☆ <!-- .element: class="rating" -->

<div class="two-column">
<pre class="before" data-since="Drupal 8-11.x"><code class="language-php" data-trim>
// modules/mymodule_test/mymodule_test.routing.yml
mymodule_test.page:
  path: '/mymodule-test'
  defaults:
    _controller: '\Drupal\mymodule_test\Controller\TestController::page'
  requirements:
    _access: 'TRUE'
// plus a whole test module
</code></pre>
<pre class="after fragment fade-in" data-since="11.5 / 12.0"><code class="language-php" data-trim>
class MyKernelTest extends KernelTestBase {
  #[Route(
    path: '/mymodule-test',
    name: 'mymodule_test.page',
    requirements: ['_access' =&gt; 'TRUE'])
  ]
  public function page(): array {
    return ['#markup' =&gt; 'hello'];
  }
  public function testPage(): void {
    $this-&gt;drupalGet('/mymodule-test');
  }
}
</code></pre>
</div>

Note:
- Available from: 11.5/12.0
- Issue #3586832; CR https://www.drupal.org/node/3605544 "Kernel test classes can define their own routes using the Route attribute"
- Builds on route attributes (#3311365) and drupalGet() in kernel tests (#3390193)
- Related: functional tests being converted to kernel tests across core for speed

---

### Shared test environment and container

★★★★☆ <!-- .element: class="rating" -->

<div class="two-column">
<div><pre class="before" data-since="Drupal 8-12.0 alpha"><code class="language-php" data-trim>
#[Group('node')]
class NodeTypeValidationTest extends KernelTestBase {
  // Every test method:
  //  - installs modules and schema again
  //  - builds a new container
  public function testA(): void {}
  public function testB(): void {}
}
</code></pre></div>
<div><pre class="after fragment fade-in" data-since="main / 12.0"><code class="language-php" data-trim>
use Drupal\TestTools\Attribute\ShareEnvironment;
#[Group ('node')]
#[ShareEnvironment]
class NodeTypeValidationTest extends KernelTestBase {
  // Environment built once per class,
  // container re-used from cache
  public function testA (): void {}
  public function testB (): void {}
}
</code></pre></div>
</div>

Note:
- Available from: 12.0main, committed 2026-10-10 as 6868135abe8 (#3613347 "Re-use container in kernel tests"); builds on #1411074 "Allow kernel tests to share the test environment" (19c7eca36f, 2026-10-06). An 11.x backport (MR !17548) was pending - VERIFY the release before presenting
- Side effect: the in-memory key/value factory is gone; the `keyvalue` service now comes from the container (backed by the database when the environment is shared)
- Reported speed-up in the issue: NodeTypeValidationTest (26 tests) 18.9s to 14.7s; per-method cost about 2.5s down to about 0.7s with xhprof on
- The catch: methods no longer start from a clean environment. Do not assert on absolute IDs or row counts, read IDs from the entities you create, assert on the change your test causes
- Each test class declares the attribute itself - it is not inherited
- Rolling the attribute out to all kernel tests in core is in progress

---

## Honourable mentions

Note:
- Not strictly "code you write every day", but they change how you build sites

---

### Recipes in install profiles

★★★★☆ <!-- .element: class="rating" -->

<div class="two-column">
<pre class="before" data-since="Drupal 10.3-11.4"><code class="language-yaml" data-trim>
# mysite.info.yml
type: profile
name: My site
install:
  - node
  - views
  - mymodule
# plus a hook_install() that
# creates content types and config
</code></pre>
<pre class="after fragment fade-in" data-since="Drupal 11.5+"><code class="language-yaml" data-trim>
# mysite.info.yml
type: profile
name: My site
recipes:
  - some/recipe/mysite_content_types
  - some/recipe/mysite_editor_roles
</code></pre>
</div>

Note:
- Available from: recipes = Drupal 10.3.0; `recipes` key in profile info.yml = 11.5.0 (merged 2026-07-21)
- Issue #3605549; CR https://www.drupal.org/node/3612237
- Recipes run after modules are installed, appended to the same batch
- Also: recipe discovery helper class (#3446354, main), profiles apply recipes while Standard/Umami are being slimmed down onto recipes

---

## Thanks - questions?

Feedback:
- Reference blog post from Mike
- Don't squash code down - fix whitespace
- Drop share environment - drupalGet in kernel tests
- Take out readonly properties
- Ways to support D10
- Light mode
- Depends on module attribute
- Defining #AutoWire vs in module for contrib
- Named arguments policy
