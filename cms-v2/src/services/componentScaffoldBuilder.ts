import type { LayoutAnalysis } from './genericLayoutAnalyzer';

export interface ComponentScaffold {
  componentName: string;
  /** Ordered children-first, then the parent — nested `bloks` fields reference earlier entries by name. */
  storyblokSchema: { components: Array<Record<string, unknown>> };
  tsxCode: string;
  typeCode: string;
}

function pascalCase(name: string): string {
  return name
    .split('_')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function textField(displayName: string): Record<string, unknown> {
  return { type: 'text', display_name: displayName };
}

function textareaField(displayName: string): Record<string, unknown> {
  return { type: 'textarea', display_name: displayName };
}

function linkField(displayName: string): Record<string, unknown> {
  return { type: 'multilink', display_name: displayName };
}

function blokField(displayName: string, whitelist: string[]): Record<string, unknown> {
  return {
    type: 'bloks',
    display_name: displayName,
    restrict_components: true,
    component_whitelist: whitelist,
  };
}

function nestableComponent(name: string, displayName: string, schema: Record<string, unknown>): Record<string, unknown> {
  return {
    name,
    display_name: displayName,
    is_root: false,
    is_nestable: true,
    schema,
  };
}

/**
 * Builds a Storyblok component schema (parent + nested child components) and matching TSX/type
 * scaffolds from a best-effort layout analysis. Everything here is a starting point for manual
 * editing, not a finished component — field names/shape will very likely need correction.
 */
export function buildComponentScaffold(analysis: LayoutAnalysis, componentName: string): ComponentScaffold {
  const navItemName = `${componentName}_nav_item`;
  const navGroupName = `${componentName}_nav_group`;
  const cardName = `${componentName}_card`;
  const cardGroupName = `${componentName}_card_group`;

  const components: Array<Record<string, unknown>> = [
    nestableComponent(navItemName, 'Nav item', {
      text: textField('Text'),
      link: linkField('Link'),
    }),
    nestableComponent(navGroupName, 'Nav group', {
      label: textField('Label'),
      items: blokField('Items', [navItemName]),
    }),
    nestableComponent(cardName, 'Card', {
      title: textField('Title'),
      description: textareaField('Description'),
      link: linkField('Link'),
    }),
    nestableComponent(cardGroupName, 'Card group', {
      group_label: textField('Group label'),
      cards: blokField('Cards', [cardName]),
    }),
    nestableComponent(componentName, pascalCase(componentName), {
      eyebrow: textField('Eyebrow'),
      heading_prefix: textField('Heading prefix'),
      heading_accent: textField('Heading accent'),
      nav_groups: blokField('Sidebar nav groups', [navGroupName]),
      card_groups: blokField('Card groups', [cardGroupName]),
    }),
  ];

  const componentTypeName = `${pascalCase(componentName)}Blok`;

  const typeCode = `export interface ${pascalCase(componentName)}NavItemBlok {
  _uid: string;
  component: '${navItemName}';
  text?: string;
  link?: { url?: string; cached_url?: string };
}

export interface ${pascalCase(componentName)}NavGroupBlok {
  _uid: string;
  component: '${navGroupName}';
  label?: string;
  items?: ${pascalCase(componentName)}NavItemBlok[];
}

export interface ${pascalCase(componentName)}CardBlok {
  _uid: string;
  component: '${cardName}';
  title?: string;
  description?: string;
  link?: { url?: string; cached_url?: string };
}

export interface ${pascalCase(componentName)}CardGroupBlok {
  _uid: string;
  component: '${cardGroupName}';
  group_label?: string;
  cards?: ${pascalCase(componentName)}CardBlok[];
}

export interface ${componentTypeName} {
  _uid: string;
  component: '${componentName}';
  eyebrow?: string;
  heading_prefix?: string;
  heading_accent?: string;
  nav_groups?: ${pascalCase(componentName)}NavGroupBlok[];
  card_groups?: ${pascalCase(componentName)}CardGroupBlok[];
}
`;

  const componentFnName = pascalCase(componentName);
  const tsxCode = `import type { ${componentTypeName} } from "@/types/storyblok";
import { sbEdit } from "./editable";
import { resolveHref } from "./utils";
import { LiveLink } from "@/components/layout/LiveLink";

// TODO: this scaffold was auto-generated from a best-effort scrape of the live page
// (sidebar nav groups + grouped cards). Review every field/class name before shipping —
// see templateSections.tsx for the shared sectionPad/SectionHead conventions.
export function ${componentFnName}({ blok }: { blok: ${componentTypeName} }) {
  return (
    <section className="tpl-${componentName.replace(/_/g, '-')}" {...sbEdit(blok)}>
      <div className="vls-container tpl-${componentName.replace(/_/g, '-')}-grid">
        {blok.nav_groups?.length ? (
          <aside className="tpl-${componentName.replace(/_/g, '-')}-sidebar">
            {blok.nav_groups.map((group) => (
              <div key={group._uid} {...sbEdit(group)}>
                {group.label ? <h3>{group.label}</h3> : null}
                <ul>
                  {group.items?.map((item) => (
                    <li key={item._uid} {...sbEdit(item)}>
                      <LiveLink href={resolveHref(item.link) || "#"}>{item.text}</LiveLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </aside>
        ) : null}

        <div className="tpl-${componentName.replace(/_/g, '-')}-main">
          {blok.heading_prefix || blok.heading_accent ? (
            <h2>
              {blok.heading_prefix}{" "}
              {blok.heading_accent ? <span className="vls-accent">{blok.heading_accent}</span> : null}
            </h2>
          ) : null}

          {blok.card_groups?.map((group) => (
            <div key={group._uid} {...sbEdit(group)}>
              {group.group_label ? <h3>{group.group_label}</h3> : null}
              <div className="tpl-${componentName.replace(/_/g, '-')}-cards">
                {group.cards?.map((card) => (
                  <div key={card._uid} className="tpl-${componentName.replace(/_/g, '-')}-card" {...sbEdit(card)}>
                    {card.title ? <h4><LiveLink href={resolveHref(card.link) || "#"}>{card.title}</LiveLink></h4> : null}
                    {card.description ? <p>{card.description}</p> : null}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
`;

  return {
    componentName,
    storyblokSchema: { components },
    tsxCode,
    typeCode,
  };
}
