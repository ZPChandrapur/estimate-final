import { supabase } from '../../lib/supabase';
import { Work, SubWork, SubworkItem, ItemMeasurement, ItemLead, ItemMaterial, ItemRate, EstimateTemplate } from '../../types';

export interface CompleteEstimateData {
  work: Work;
  subworks: SubWork[];
  subworkItems: { [subworkId: string]: SubworkItem[] };
  measurements: { [itemId: string]: ItemMeasurement[] };
  leads: { [itemId: string]: ItemLead[] };
  materials: { [itemId: string]: ItemMaterial[] };
  rates: { [itemId: string]: ItemRate[] };
}

export class EstimateSupabaseOperations {
  
  /**
   * Fetch complete estimate data for a given work ID
   */
  static async fetchCompleteEstimateData(worksId: string): Promise<CompleteEstimateData | null> {
    try {
      // Fetch work details
      const { data: work, error: workError } = await supabase
        .schema('estimate')
        .from('works')
        .select('*')
        .eq('works_id', worksId)
        .single();

      if (workError || !work) throw workError;

      // Fetch subworks
      const { data: subworks, error: subworksError } = await supabase
        .schema('estimate')
        .from('subworks')
        .select('*')
        .eq('works_id', worksId)
        .order('sr_no');

      if (subworksError) throw subworksError;

      // Fetch all related data
      const subworkItems: { [subworkId: string]: SubworkItem[] } = {};
      const measurements: { [itemId: string]: ItemMeasurement[] } = {};
      const leads: { [itemId: string]: ItemLead[] } = {};
      const materials: { [itemId: string]: ItemMaterial[] } = {};
      const rates: { [itemId: string]: ItemRate[] } = {};

      for (const subwork of subworks || []) {
        const { data: items } = await supabase
          .schema('estimate')
          .from('subwork_items')
          .select('*')
          .eq('subwork_id', subwork.subworks_id)
          .order('sr_no');

        subworkItems[subwork.subworks_id] = items || [];

        // Fetch measurements, leads, and materials for each item
        for (const item of items || []) {
          const [measurementsRes, leadsRes, materialsRes, ratesRes] = await Promise.all([
            supabase.schema('estimate').from('item_measurements').select('*').eq('subwork_item_id', item.sr_no),
            supabase.schema('estimate').from('item_leads').select('*').eq('subwork_item_sr_no', item.sr_no),
            supabase.schema('estimate').from('item_materials').select('*').eq('subwork_item_sr_no', item.sr_no),
            supabase.schema('estimate').from('item_rates').select('*').eq('subwork_item_sr_no', item.sr_no)
          ]);

          measurements[item.id] = measurementsRes.data || [];
          leads[item.id] = leadsRes.data || [];
          materials[item.id] = materialsRes.data || [];
          rates[item.id] = ratesRes.data || [];
        }
      }

      return {
        work,
        subworks: subworks || [],
        subworkItems,
        measurements,
        leads,
        materials,
        rates
      };
    } catch (error) {
      console.error('Error fetching complete estimate data:', error);
      return null;
    }
  }

  /**
   * Fetch all works for selection
   */
  static async fetchWorks(): Promise<Work[]> {
    try {
      const { data, error } = await supabase
        .schema('estimate')
        .from('works')
        .select('*')
        .order('sr_no', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching works:', error);
      return [];
    }
  }

  /**
   * Fetch estimate templates
   */
  static async fetchTemplates(): Promise<EstimateTemplate[]> {
    try {
      const { data, error } = await supabase
        .schema('estimate')
        .from('estimate_templates')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching templates:', error);
      return [];
    }
  }

  /**
   * Save estimate as template
   */
  static async saveAsTemplate(
    templateName: string,
    templateDescription: string,
    worksId: string,
    userId: string
  ): Promise<boolean> {
    try {
      // Fetch complete estimate data
      const completeData = await this.fetchCompleteEstimateData(worksId);
      if (!completeData) {
        throw new Error('Error fetching estimate data');
      }

      // Save template
      const { error } = await supabase
        .schema('estimate')
        .from('estimate_templates')
        .insert([{
          template_name: templateName.trim(),
          description: templateDescription.trim() || null,
          original_works_id: worksId,
          template_data: completeData,
          created_by: userId
        }]);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error saving template:', error);
      return false;
    }
  }

  /**
   * Generate new works ID
   */
  static async generateNewWorksId(): Promise<string> {
    try {
      const { data, error } = await supabase
        .schema('estimate')
        .from('works')
        .select('works_id, sr_no')
        .order('works_id', { ascending: false })
        .limit(1);

      if (error) throw error;

      let nextNumber = 1;
      if (data && data.length > 0) {
        const lastWorksId = data[0].works_id;
        const match = lastWorksId.match(/(\d+)$/);
        if (match) {
          nextNumber = parseInt(match[1]) + 1;
        }
      }

      return `WORK-${nextNumber.toString().padStart(4, '0')}`;
    } catch (error) {
      console.error('Error generating works ID:', error);
      return `WORK-${Date.now()}`;
    }
  }

  /**
   * Create estimate from template
   */
  static async createEstimateFromTemplate(
    template: EstimateTemplate,
    userId: string
  ): Promise<string | null> {
    try {
      const newWorksId = await this.generateNewWorksId();
      const templateData = template.template_data;

      // Create new work
      const newWork = {
        works_id: newWorksId,
        work_name: `${templateData.work.work_name} (From Template)`,
        type: templateData.work.type,
        division: templateData.work.division,
        sub_division: templateData.work.sub_division,
        major_head: templateData.work.major_head,
        minor_head: templateData.work.minor_head,
        service_head: templateData.work.service_head,
        departmental_head: templateData.work.departmental_head,
        fund_head: templateData.work.fund_head,
        sanctioning_authority: templateData.work.sanctioning_authority,
        ssr: templateData.work.ssr,
        status: 'draft' as const,
        created_by: userId,
        total_estimated_cost: 0
      };

      const { data: createdWork, error: workError } = await supabase
        .schema('estimate')
        .from('works')
        .insert([newWork])
        .select()
        .single();

      if (workError) throw workError;

      // Create subworks
      const subworkMapping: { [oldId: string]: string } = {};
      for (const subwork of templateData.subworks) {
        const newSubworkId = `${newWorksId}-${subwork.subworks_id.split('-').pop()}`;
        subworkMapping[subwork.subworks_id] = newSubworkId;

        const { error: subworkError } = await supabase
          .schema('estimate')
          .from('subworks')
          .insert([{
            works_id: newWorksId,
            subworks_id: newSubworkId,
            subworks_name: subwork.subworks_name,
            created_by: userId
          }]);

        if (subworkError) throw subworkError;

        // Create subwork items
        const items = templateData.subworkItems[subwork.subworks_id] || [];
        for (const item of items) {
          const { data: createdItem, error: itemError } = await supabase
            .schema('estimate')
            .from('subwork_items')
            .insert([{
              subwork_id: newSubworkId,
              item_number: item.item_number,
              category: item.category,
              description_of_item: item.description_of_item,
              ssr_quantity: item.ssr_quantity,
              ssr_rate: item.ssr_rate,
              ssr_unit: item.ssr_unit,
              total_item_amount: item.total_item_amount,
              created_by: userId
            }])
            .select()
            .single();

          if (itemError) throw itemError;

          // Create measurements
          const measurements = templateData.measurements[item.id] || [];
          for (const measurement of measurements) {
            const { error: measurementError } = await supabase
              .schema('estimate')
              .from('item_measurements')
              .insert([{
                subwork_item_id: createdItem.sr_no,
                measurement_sr_no: measurement.measurement_sr_no,
                description_of_items: measurement.description_of_items,
                no_of_units: measurement.no_of_units,
                length: measurement.length,
                width_breadth: measurement.width_breadth,
                height_depth: measurement.height_depth,
                calculated_quantity: measurement.calculated_quantity,
                unit: measurement.unit,
              }]);

            if (measurementError) throw measurementError;
          }

          // Create leads
          const leads = templateData.leads[item.id] || [];
          for (const lead of leads) {
            const { error: leadError } = await supabase
              .schema('estimate')
              .from('item_leads')
              .insert([{
                subwork_item_sr_no: createdItem.sr_no,
                material: lead.material,
                location_of_quarry: lead.location_of_quarry,
                lead_in_km: lead.lead_in_km,
                lead_charges: lead.lead_charges,
                initial_lead_charges: lead.initial_lead_charges,
                net_lead_charges: lead.net_lead_charges
              }]);

            if (leadError) throw leadError;
          }

          // Create materials
          const materials = templateData.materials[item.id] || [];
          for (const material of materials) {
            const { error: materialError } = await supabase
              .schema('estimate')
              .from('item_materials')
              .insert([{
                subwork_item_sr_no: createdItem.sr_no,
                material_name: material.material_name,
                required_quantity: material.required_quantity,
                unit: material.unit,
                rate_per_unit: material.rate_per_unit,
                total_material_cost: material.total_material_cost
              }]);

            if (materialError) throw materialError;
          }

          // Create rates
          const rates = templateData.rates[item.id] || [];
          for (const rate of rates) {
            const { error: rateError } = await supabase
              .schema('estimate')
              .from('item_rates')
              .insert([{
                subwork_item_sr_no: createdItem.sr_no,
                description: rate.description,
                rate: rate.rate,
                unit: rate.unit,
                document_reference: rate.document_reference,
                created_by: userId
              }]);

            if (rateError) throw rateError;
          }
        }
      }

      return newWorksId;
    } catch (error) {
      console.error('Error creating estimate from template:', error);
      return null;
    }
  }

  /**
   * Delete template
   */
  static async deleteTemplate(templateId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .schema('estimate')
        .from('estimate_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting template:', error);
      return false;
    }
  }
}
