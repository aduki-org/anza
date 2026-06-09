use scraper::Html;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::Path;

#[derive(Serialize, Deserialize, Debug)]
pub struct TagsDescriptor {
    pub refs: Vec<String>,
    pub ids: Vec<String>,
    pub classes: Vec<String>,
    pub tags: Vec<String>,
    pub compound: Vec<String>,
}

pub fn parse_and_emit(html_path: &Path) {
    let content = match std::fs::read_to_string(html_path) {
        Ok(c) => c,
        Err(_) => return,
    };

    let document = Html::parse_fragment(&content);

    let mut refs = HashSet::new();
    let mut ids = HashSet::new();
    let mut classes = HashSet::new();
    let mut tags = HashSet::new();
    let mut compound = HashSet::new();

    // Iterate over all elements in the parsed tree
    for node in document.tree.values() {
        if let Some(element) = node.as_element() {
            let tag_name = element.name();
            tags.insert(tag_name.to_string());

            if let Some(id) = element.attr("id") {
                ids.insert(id.to_string());
            }

            if let Some(r) = element.attr("ref") {
                refs.insert(r.to_string());
            }

            for class in element.classes() {
                classes.insert(class.to_string());
                compound.insert(format!("{}.{}", tag_name, class));
            }
        }
    }

    let mut refs_vec: Vec<_> = refs.into_iter().collect();
    refs_vec.sort();
    let mut ids_vec: Vec<_> = ids.into_iter().collect();
    ids_vec.sort();
    let mut classes_vec: Vec<_> = classes.into_iter().collect();
    classes_vec.sort();
    let mut tags_vec: Vec<_> = tags.into_iter().collect();
    tags_vec.sort();
    let mut compound_vec: Vec<_> = compound.into_iter().collect();
    compound_vec.sort();

    let descriptor = TagsDescriptor {
        refs: refs_vec,
        ids: ids_vec,
        classes: classes_vec,
        tags: tags_vec,
        compound: compound_vec,
    };

    // Emit the JSON descriptor alongside the .html file
    let mut json_path = html_path.to_path_buf();
    json_path.set_extension("tags.json");

    if let Ok(json) = serde_json::to_string_pretty(&descriptor) {
        let _ = std::fs::write(&json_path, json);
        println!("Generated tags descriptor for {:?}", html_path.file_name().unwrap_or_default());
    }
}
